// Combat resolution: authoritative damage, attack state machines, melee hit
// detection (range + arc, once per swing), projectile stepping, blocking,
// sneak attacks, death + loot rolling. LOCKED D-007 constants in types.ts.

import {
  ARMOR_DR_CAP,
  ARMOR_DR_FACTOR,
  ARROW_SPEED,
  ATTACK_STAMINA_COST,
  BLOCK_ARC_COS,
  BLOCK_STAMINA_ON_HIT,
  DOWNED_TICKS,
  DT,
  INTERRUPT_DAMAGE,
  MELEE_ACTIVE_TICKS,
  MELEE_ARC_COS,
  MELEE_HEIGHT_TOLERANCE,
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
  type QueuedAttack,
  type SimEvent,
  type Vec3,
} from '../types';
import type { SimContext } from '../sim_context';
import { rollLoot } from '../inventory/inventory';
import { executeAbility } from '../ai/abilities';
import { reticleDirection } from '../player/aim';

let nextProjectileId = 1;

/** Reset module counter (tests / new sim instances). */
export function resetProjectileIds(): void {
  nextProjectileId = 1;
}

// ---------------------------------------------------------------------------
// Damage
// ---------------------------------------------------------------------------

export function mitigate(
  target: Actor,
  amount: number,
  channel: DamageChannel,
  allowBlock = true,
): { taken: number; blocked: boolean } {
  let dmg = amount;
  // Armor DR applies to physical only.
  if (channel === 'physical') {
    const dr = Math.min(ARMOR_DR_CAP, target.stats.armor * ARMOR_DR_FACTOR * 0.1);
    dmg *= 1 - dr;
  }
  const resist = target.stats[RESIST_BY_CHANNEL[channel]];
  dmg *= 1 - resist;
  let blocked = false;
  if (allowBlock && target.blocking && target.stamina > 0) {
    dmg *= 1 - Math.min(0.9, target.stats.blockMitigation);
    blocked = true;
  }
  return { taken: Math.max(0, dmg), blocked };
}

function sourceInsideBlockArc(
  ctx: SimContext,
  target: Actor,
  sourceId: EntityId,
  blockOrigin?: Vec3,
): boolean {
  const source = ctx.actors.get(sourceId);
  if (!source || source.dead || source.pos.spaceId !== target.pos.spaceId) return false;
  const origin = blockOrigin ?? source.pos;
  const dx = origin.x - target.pos.x;
  const dz = origin.z - target.pos.z;
  const distance = Math.hypot(dx, dz);
  if (distance < 0.001) return false;
  const forward = facing(target);
  return (dx / distance) * forward.x + (dz / distance) * forward.z >= BLOCK_ARC_COS;
}

export function dealDamage(
  ctx: SimContext,
  targetId: EntityId,
  sourceId: EntityId,
  amount: number,
  channel: DamageChannel,
  blockable = true,
  blockOrigin?: Vec3,
): void {
  const target = ctx.actors.get(targetId);
  if (!target || target.dead || amount <= 0) return;
  if (target.downed) return; // downed players are out of the fight, not corpses
  const allowBlock = blockable && sourceInsideBlockArc(ctx, target, sourceId, blockOrigin);
  const { taken, blocked } = mitigate(target, amount, channel, allowBlock);
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
  if (!a) return false;
  if (a.dead || a.downed) return rejectAction(ctx, a, 'melee', 'incapacitated');
  if (a.attack) return bufferAttack(ctx, a, { kind: 'melee' });
  if (a.kind === 'player' && a.stamina < ATTACK_STAMINA_COST) {
    return rejectAction(ctx, a, 'melee', 'stamina');
  }
  if (a.kind === 'player') a.stamina -= ATTACK_STAMINA_COST;
  a.blocking = false;
  a.attack = { kind: 'melee', phase: 'windup', t: MELEE_WINDUP_TICKS };
  return true;
}

export function startRanged(ctx: SimContext, attackerId: EntityId): boolean {
  const a = ctx.actors.get(attackerId);
  if (!a) return false;
  if (a.dead || a.downed) return rejectAction(ctx, a, 'ranged', 'incapacitated');
  if (a.attack) return bufferAttack(ctx, a, { kind: 'ranged' });
  if (a.kind === 'player') {
    const weapon = a.equipment.mainHand ? ctx.content.items[a.equipment.mainHand] : null;
    if (!weapon || weapon.weaponType !== 'bow') return rejectAction(ctx, a, 'ranged', 'weapon');
    const hasArrow = a.inventory.some((s) => s.itemId === 'arrow' && s.count > 0);
    if (!hasArrow) return rejectAction(ctx, a, 'ranged', 'ammo');
  }
  a.blocking = false;
  a.attack = { kind: 'ranged', phase: 'windup', t: RANGED_WINDUP_TICKS };
  return true;
}

export function startSpell(ctx: SimContext, attackerId: EntityId, spellId: string): boolean {
  const a = ctx.actors.get(attackerId);
  const spell = ctx.content.spells[spellId];
  if (!a) return false;
  if (a.dead || a.downed) return rejectAction(ctx, a, 'spell', 'incapacitated');
  if (!spell) return rejectAction(ctx, a, 'spell', 'unknown');
  if (a.attack) return bufferAttack(ctx, a, { kind: 'spell', spellId });
  if (a.magicka < spell.magickaCost) return rejectAction(ctx, a, 'spell', 'magicka');
  a.magicka -= spell.magickaCost;
  a.blocking = false;
  a.attack = { kind: 'spell', phase: 'windup', t: SPELL_WINDUP_TICKS, spellId };
  return true;
}

function facing(a: Actor): { x: number; z: number } {
  return { x: Math.sin(a.yaw), z: Math.cos(a.yaw) };
}

function rejectAction(
  ctx: SimContext,
  actor: Actor,
  action: QueuedAttack['kind'],
  reason: Extract<SimEvent, { type: 'actionRejected' }>['reason'],
): false {
  ctx.emit({ type: 'actionRejected', actorId: actor.id, action, reason });
  return false;
}

function bufferAttack(ctx: SimContext, actor: Actor, queued: QueuedAttack): boolean {
  const current = actor.attack;
  if (!current || current.phase === 'windup' || current.telegraph) {
    return rejectAction(ctx, actor, queued.kind, 'busy');
  }
  current.queued = queued;
  return true;
}

function startQueuedAttack(ctx: SimContext, actor: Actor, queued: QueuedAttack): void {
  if (queued.kind === 'melee') startMelee(ctx, actor.id);
  else if (queued.kind === 'ranged') startRanged(ctx, actor.id);
  else if (queued.spellId) startSpell(ctx, actor.id, queued.spellId);
}

/** Melee hit check: range + arc against every hostile living actor in space. */
function resolveMeleeHit(ctx: SimContext, attacker: Actor): void {
  const dir = facing(attacker);
  for (const target of ctx.actors.values()) {
    if (target.id === attacker.id || target.dead || target.downed) continue;
    if (target.pos.spaceId !== attacker.pos.spaceId) continue;
    const dx = target.pos.x - attacker.pos.x;
    const dz = target.pos.z - attacker.pos.z;
    const dy = target.pos.y - attacker.pos.y;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > MELEE_RANGE) continue;
    if (Math.abs(dy) > MELEE_HEIGHT_TOLERANCE) continue;
    const dot = dist > 0.001 ? (dx / dist) * dir.x + (dz / dist) * dir.z : 1;
    if (dot < MELEE_ARC_COS) continue;
    if (!ctx.isHostile(attacker, target)) continue;
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
  const dir = kind === 'spell' && attacker.kind === 'player'
    ? reticleDirection(attacker.yaw, attacker.aimPitch)
    : { ...facing(attacker), y: 0 };
  const speed = kind === 'arrow' ? ARROW_SPEED : SPELL_PROJECTILE_SPEED;
  ctx.projectiles.push({
    id: nextProjectileId++,
    spaceId: attacker.pos.spaceId,
    pos: {
      x: attacker.pos.x + dir.x * 0.7,
      y: attacker.pos.y + 1.4 + dir.y * 0.7,
      z: attacker.pos.z + dir.z * 0.7,
    },
    vel: { x: dir.x * speed, y: dir.y * speed, z: dir.z * speed },
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
        if (!ctx.removeItem(a.id, 'arrow', 1)) {
          rejectAction(ctx, a, 'ranged', 'ammo');
          atk.phase = 'recover';
          atk.t = MELEE_RECOVER_TICKS;
          return;
        }
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
    const queued = atk.queued;
    a.attack = null;
    if (queued) startQueuedAttack(ctx, a, queued);
  }
}

function segmentSphereEntry(from: Vec3, to: Vec3, center: Vec3, radiusSq: number): number | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const lengthSq = dx * dx + dy * dy + dz * dz;
  const projected =
    lengthSq > 1e-9
      ? ((center.x - from.x) * dx + (center.y - from.y) * dy + (center.z - from.z) * dz) / lengthSq
      : 0;
  const t = Math.max(0, Math.min(1, projected));
  const px = from.x + dx * t;
  const py = from.y + dy * t;
  const pz = from.z + dz * t;
  const ox = center.x - px;
  const oy = center.y - py;
  const oz = center.z - pz;
  return ox * ox + oy * oy + oz * oz < radiusSq ? t : null;
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
    const from = { ...p.pos };
    const to = {
      x: p.pos.x + p.vel.x * DT,
      y: p.pos.y + p.vel.y * DT,
      z: p.pos.z + p.vel.z * DT,
    };
    const obstruction = ctx.projectileObstruction(p.spaceId, from, to);

    // Swept actor hit: choose the earliest body along the step so entity
    // iteration order cannot decide which target an arrow strikes.
    let hitTarget: Actor | null = null;
    let hitT: number | null = null;
    for (const target of ctx.actors.values()) {
      if (target.id === p.sourceId || target.dead || target.downed) continue;
      if (target.pos.spaceId !== p.spaceId) continue;
      const t = segmentSphereEntry(from, to, { x: target.pos.x, y: target.pos.y + 1.2, z: target.pos.z }, 0.8);
      if (t !== null && (hitT === null || t < hitT)) {
        hitTarget = target;
        hitT = t;
      }
    }

    if (hitTarget && hitT !== null && (obstruction === null || hitT < obstruction)) {
      const src = ctx.actors.get(p.sourceId);
      if (src && ctx.isHostile(src, hitTarget)) {
        ctx.dealDamage(
          hitTarget.id,
          p.sourceId,
          p.damage * ctx.rng.range(0.9, 1.1),
          p.channel,
          true,
          from,
        );
        if (p.kind === 'spell' && p.spellId) {
          const spell = ctx.content.spells[p.spellId];
          for (const e of spell?.applyEffects ?? []) {
            ctx.applyEffect(hitTarget.id, e, `spell:${p.spellId}`);
          }
        }
      }
      list.splice(i, 1);
      continue;
    }
    if (obstruction !== null) {
      list.splice(i, 1);
      continue;
    }
    p.pos = to;
  }
}
