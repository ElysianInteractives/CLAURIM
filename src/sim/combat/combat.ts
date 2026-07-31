// Combat resolution: authoritative damage, attack state machines, melee hit
// detection (range + arc, once per swing), projectile stepping, blocking,
// sneak attacks, death + loot rolling. LOCKED D-007 constants in types.ts.

import {
  ARMOR_DR_CAP,
  ARMOR_DR_FACTOR,
  ARROW_SPEED,
  ATTACK_STAMINA_COST,
  BLOCK_STAMINA_ON_HIT,
  DOWNED_TICKS,
  DT,
  INTERRUPT_DAMAGE,
  MELEE_ACTIVE_TICKS,
  MELEE_ARC_COS,
  MELEE_RANGE,
  MELEE_RECOVER_TICKS,
  MELEE_WINDUP_TICKS,
  RANGED_WINDUP_TICKS,
  RESIST_BY_CHANNEL,
  SNEAK_ATTACK_MULT,
  SPELL_PROJECTILE_SPEED,
  SPELL_WINDUP_TICKS,
  THREAT_PER_DAMAGE,
  type Actor,
  type DamageChannel,
  type EntityId,
} from '../types';
import type { SimContext } from '../sim_context';
import { rollLoot } from '../inventory/inventory';
import { executeAbility } from '../ai/abilities';

let nextProjectileId = 1;

/** Reset module counter (tests / new sim instances). */
export function resetProjectileIds(): void {
  nextProjectileId = 1;
}

// ---------------------------------------------------------------------------
// Damage
// ---------------------------------------------------------------------------

export function mitigate(target: Actor, amount: number, channel: DamageChannel): { taken: number; blocked: boolean } {
  let dmg = amount;
  // Armor DR applies to physical only.
  if (channel === 'physical') {
    const dr = Math.min(ARMOR_DR_CAP, target.stats.armor * ARMOR_DR_FACTOR * 0.1);
    dmg *= 1 - dr;
  }
  const resist = target.stats[RESIST_BY_CHANNEL[channel]];
  dmg *= 1 - resist;
  let blocked = false;
  if (target.blocking && target.stamina > 0) {
    dmg *= 1 - Math.min(0.9, target.stats.blockMitigation);
    blocked = true;
  }
  return { taken: Math.max(0, dmg), blocked };
}

export function dealDamage(
  ctx: SimContext,
  targetId: EntityId,
  sourceId: EntityId,
  amount: number,
  channel: DamageChannel,
): void {
  const target = ctx.actors.get(targetId);
  if (!target || target.dead || amount <= 0) return;
  if (target.downed) return; // downed players are out of the fight, not corpses
  const { taken, blocked } = mitigate(target, amount, channel);
  target.health -= taken;
  if (blocked) {
    target.stamina = Math.max(0, target.stamina - BLOCK_STAMINA_ON_HIT);
    if (target.kind === 'player') ctx.trainSkill(targetId, 'block', 4);
  } else if (target.kind === 'player' && channel === 'physical' && target.equipment.body) {
    ctx.trainSkill(targetId, 'lightArmor', 3);
  }
  ctx.emit({ type: 'damage', targetId, sourceId, amount: taken, channel, blocked });
  // Threat + aggro: getting hit adds threat and wakes the target's brain (D-017).
  if (target.brain && sourceId !== 0) {
    const src = ctx.actors.get(sourceId);
    if (src && ctx.isHostile(target, src)) {
      target.brain.threat[sourceId] = (target.brain.threat[sourceId] ?? 0) + taken * THREAT_PER_DAMAGE;
      if (target.brain.state !== 'combat') {
        target.brain.state = 'combat';
        target.brain.targetId = sourceId;
      }
      target.brain.lastKnownPos = { ...src.pos };
    }
  }
  // Interruption: damaging an interruptible telegraph cancels it (D-018).
  const atk = target.attack;
  if (atk?.telegraph && atk.interruptible && atk.phase === 'windup') {
    atk.interruptDamage = (atk.interruptDamage ?? 0) + taken;
    const tpl = ctx.content.actors[target.templateId];
    if (!tpl?.interruptImmune && atk.interruptDamage >= INTERRUPT_DAMAGE && atk.abilityId) {
      ctx.emit({ type: 'interrupted', sourceId: targetId, abilityId: atk.abilityId });
      target.attack = null;
      if (target.brain) target.brain.timer = 45; // staggered pause after interrupt
    }
  }
  if (target.health <= 0) {
    handleDeath(ctx, targetId, sourceId);
  }
}

export function handleDeath(ctx: SimContext, targetId: EntityId, killerId: EntityId): void {
  const target = ctx.actors.get(targetId);
  if (!target || target.dead) return;

  // Players go DOWNED instead of dying outright (D-021): incapacitated,
  // revivable by party members, auto-release after DOWNED_TICKS.
  if (target.kind === 'player') {
    target.downed = true;
    target.downedTicks = DOWNED_TICKS;
    target.health = 0;
    target.attack = null;
    target.blocking = false;
    target.sprinting = false;
    ctx.emit({ type: 'playerDowned', playerId: targetId });
    return;
  }

  target.dead = true;
  target.health = 0;
  target.attack = null;
  target.blocking = false;
  if (target.brain) target.brain.state = 'dead';

  const tpl = ctx.content.actors[target.templateId];
  if (!target.lootRolled) {
    target.lootRolled = true;
    const tableId = tpl?.lootTable;
    if (tableId) {
      const table = ctx.content.lootTables[tableId];
      if (table) {
        if (tpl?.tier === 'boss' || tpl?.tier === 'elite') {
          // PERSONAL loot (D-019): every eligible party member near the kill
          // receives an independent roll directly to their inventory.
          const killerChar = ctx.charIdOf(killerId);
          const recipients = killerChar ? ctx.partyMembersOf(killerChar) : [];
          let delivered = false;
          for (const charId of recipients) {
            const member = ctx.actorByCharId(charId);
            if (!member || member.dead) continue;
            if (member.pos.spaceId !== target.pos.spaceId) continue;
            const rolled = rollLoot(ctx.rng, table);
            for (const it of rolled.items) ctx.addItem(member.id, it.itemId, it.count);
            member.gold += rolled.gold;
            delivered = true;
          }
          if (!delivered) {
            // No player credit (e.g. environmental death): shared corpse loot.
            const rolled = rollLoot(ctx.rng, table);
            for (const it of rolled.items) target.inventory.push({ itemId: it.itemId, count: it.count });
            target.gold += rolled.gold;
          }
        } else {
          // Standard enemies: one shared corpse roll (first-looter).
          const rolled = rollLoot(ctx.rng, table);
          for (const it of rolled.items) {
            const st = target.inventory.find((s) => s.itemId === it.itemId);
            if (st && ctx.content.items[it.itemId]?.stackable) st.count += it.count;
            else target.inventory.push({ itemId: it.itemId, count: it.count });
          }
          target.gold += rolled.gold;
        }
      }
    }
  }
  ctx.emit({ type: 'death', targetId, sourceId: killerId, templateId: target.templateId });
  ctx.onQuestEvent({ type: 'death', targetId, sourceId: killerId, templateId: target.templateId });
  // A summoner's adds despawn-on-death is handled by encounter reset; adds
  // dying is normal combat.
}

// ---------------------------------------------------------------------------
// Attacks
// ---------------------------------------------------------------------------

export function startMelee(ctx: SimContext, attackerId: EntityId): boolean {
  const a = ctx.actors.get(attackerId);
  if (!a || a.dead || a.attack) return false;
  if (a.kind === 'player' && a.stamina < ATTACK_STAMINA_COST) return false;
  if (a.kind === 'player') a.stamina -= ATTACK_STAMINA_COST;
  a.attack = { kind: 'melee', phase: 'windup', t: MELEE_WINDUP_TICKS };
  return true;
}

export function startRanged(ctx: SimContext, attackerId: EntityId): boolean {
  const a = ctx.actors.get(attackerId);
  if (!a || a.dead || a.attack) return false;
  if (a.kind === 'player') {
    const weapon = a.equipment.mainHand ? ctx.content.items[a.equipment.mainHand] : null;
    if (!weapon || weapon.weaponType !== 'bow') return false;
    const hasArrow = a.inventory.some((s) => s.itemId === 'arrow' && s.count > 0);
    if (!hasArrow) return false;
  }
  a.attack = { kind: 'ranged', phase: 'windup', t: RANGED_WINDUP_TICKS };
  return true;
}

export function startSpell(ctx: SimContext, attackerId: EntityId, spellId: string): boolean {
  const a = ctx.actors.get(attackerId);
  const spell = ctx.content.spells[spellId];
  if (!a || a.dead || a.attack || !spell) return false;
  if (a.magicka < spell.magickaCost) return false;
  a.magicka -= spell.magickaCost;
  a.attack = { kind: 'spell', phase: 'windup', t: SPELL_WINDUP_TICKS, spellId };
  return true;
}

function facing(a: Actor): { x: number; z: number } {
  return { x: Math.sin(a.yaw), z: Math.cos(a.yaw) };
}

/** Melee hit check: range + arc against every hostile living actor in space. */
function resolveMeleeHit(ctx: SimContext, attacker: Actor): void {
  const dir = facing(attacker);
  for (const target of ctx.actors.values()) {
    if (target.id === attacker.id || target.dead || target.downed) continue;
    if (target.pos.spaceId !== attacker.pos.spaceId) continue;
    const dx = target.pos.x - attacker.pos.x;
    const dz = target.pos.z - attacker.pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > MELEE_RANGE) continue;
    const dot = dist > 0.001 ? (dx / dist) * dir.x + (dz / dist) * dir.z : 1;
    if (dot < MELEE_ARC_COS) continue;
    if (!ctx.isHostile(attacker, target) && attacker.kind !== 'player') continue;
    let dmg = attacker.stats.meleeDamage;
    let sneakBonus = false;
    if (attacker.kind === 'player' && attacker.sneaking && target.brain && target.brain.state !== 'combat') {
      dmg *= SNEAK_ATTACK_MULT;
      sneakBonus = true;
    }
    // Small deterministic variance from sim rng.
    dmg *= ctx.rng.range(0.9, 1.1);
    const tpl = ctx.content.actors[attacker.templateId];
    const channel: DamageChannel = attacker.kind === 'player' ? 'physical' : (tpl?.attackChannel ?? 'physical');
    ctx.dealDamage(target.id, attacker.id, dmg, channel);
    if (attacker.kind === 'player') {
      ctx.trainSkill(attacker.id, 'oneHanded', 5);
      if (sneakBonus) ctx.trainSkill(attacker.id, 'sneak', 8);
    }
  }
}

function spawnProjectile(
  ctx: SimContext,
  attacker: Actor,
  kind: 'arrow' | 'spell',
  damage: number,
  channel: DamageChannel,
  spellId?: string,
): void {
  const dir = facing(attacker);
  const speed = kind === 'arrow' ? ARROW_SPEED : SPELL_PROJECTILE_SPEED;
  ctx.projectiles.push({
    id: nextProjectileId++,
    spaceId: attacker.pos.spaceId,
    pos: { x: attacker.pos.x + dir.x * 0.7, y: attacker.pos.y + 1.4, z: attacker.pos.z + dir.z * 0.7 },
    vel: { x: dir.x * speed, y: 0, z: dir.z * speed },
    channel,
    damage,
    sourceId: attacker.id,
    ttl: 3,
    kind,
    spellId,
  });
}

/** Advance one actor's attack state machine one tick. */
export function tickAttack(ctx: SimContext, actorId: EntityId): void {
  const a = ctx.actors.get(actorId);
  if (!a || a.dead || !a.attack) return;
  const atk = a.attack;
  atk.t -= 1;
  if (atk.t > 0) return;
  if (atk.phase === 'windup') {
    if (atk.abilityId) {
      // Template ability (boss/elite mechanic): resolve via the ability system.
      executeAbility(ctx, a, atk.abilityId);
      atk.phase = 'recover';
      atk.t = MELEE_RECOVER_TICKS;
      return;
    }
    if (atk.kind === 'melee') {
      atk.phase = 'active';
      atk.t = MELEE_ACTIVE_TICKS;
      resolveMeleeHit(ctx, a);
      atk.resolved = true;
    } else if (atk.kind === 'ranged') {
      // Consume an arrow (player) and release.
      if (a.kind === 'player') {
        ctx.removeItem(a.id, 'arrow', 1);
        ctx.trainSkill(a.id, 'archery', 5);
      }
      spawnProjectile(ctx, a, 'arrow', a.stats.rangedDamage, 'physical');
      atk.phase = 'recover';
      atk.t = MELEE_RECOVER_TICKS;
    } else {
      const spell = atk.spellId ? ctx.content.spells[atk.spellId] : null;
      if (spell) {
        if (spell.kind === 'projectile') {
          spawnProjectile(ctx, a, 'spell', (spell.damage ?? 0) * a.stats.spellPower, spell.channel ?? 'fire', spell.id);
        } else {
          if (spell.heal) ctx.applyHeal(a.id, spell.heal * a.stats.spellPower);
          for (const e of spell.applyEffects ?? []) ctx.applyEffect(a.id, e, `spell:${spell.id}`);
        }
        if (a.kind === 'player') ctx.trainSkill(a.id, spell.skill, 6);
      }
      atk.phase = 'recover';
      atk.t = MELEE_RECOVER_TICKS;
    }
  } else if (atk.phase === 'active') {
    atk.phase = 'recover';
    atk.t = MELEE_RECOVER_TICKS;
  } else {
    a.attack = null;
  }
}

/** Step all projectiles one tick: move, collide with actors and walls. */
export function tickProjectiles(ctx: SimContext): void {
  const list = ctx.projectiles;
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.ttl -= DT;
    if (p.ttl <= 0) {
      list.splice(i, 1);
      continue;
    }
    const nx = p.pos.x + p.vel.x * DT;
    const nz = p.pos.z + p.vel.z * DT;
    // Terrain / wall hit: projectile dies if the ground rises above it.
    const groundY = ctx.ground(p.spaceId, nx, nz);
    if (groundY > p.pos.y) {
      list.splice(i, 1);
      continue;
    }
    p.pos.x = nx;
    p.pos.z = nz;
    // Actor hit: first living actor (excluding source) within radius.
    let hit = false;
    for (const target of ctx.actors.values()) {
      if (target.id === p.sourceId || target.dead || target.downed) continue;
      if (target.pos.spaceId !== p.spaceId) continue;
      const dx = target.pos.x - p.pos.x;
      const dz = target.pos.z - p.pos.z;
      const dy = target.pos.y + 1.2 - p.pos.y;
      if (dx * dx + dz * dz + dy * dy < 0.8) {
        const src = ctx.actors.get(p.sourceId);
        // Friendly fire: only hostile pairs take projectile damage (or any pair
        // where the source is the player).
        if (src && (src.kind === 'player' || ctx.isHostile(src, target))) {
          ctx.dealDamage(target.id, p.sourceId, p.damage * ctx.rng.range(0.9, 1.1), p.channel);
          if (p.kind === 'spell' && p.spellId) {
            const spell = ctx.content.spells[p.spellId];
            for (const e of spell?.applyEffects ?? []) {
              ctx.applyEffect(target.id, e, `spell:${p.spellId}`);
            }
          }
          hit = true;
        }
        if (hit) break;
      }
    }
    if (hit) list.splice(i, 1);
  }
}
