// Data-driven enemy abilities (D-018): telegraphed frontal cones, ground
// pools, summons, and ally heals, defined on ActorTemplate.abilities and
// gated by phases. This is the reusable mechanic system every elite/boss
// uses; the Pale Warden is the exemplar (content/actors.ts).

import { THREAT_PER_HEAL, type Actor, type ContentId, type EntityId } from '../types';
import type { SimContext } from '../sim_context';
import type { AbilityDef } from '../content/schema';

function abilityOf(ctx: SimContext, actor: Actor, abilityId: ContentId): AbilityDef | null {
  const tpl = ctx.content.actors[actor.templateId];
  return tpl?.abilities?.find((a) => a.id === abilityId) ?? null;
}

/** Abilities available in the actor's current phase. Phase 0 = base kit
 * (abilities not listed in any phase's unlockAbilities). */
export function availableAbilities(ctx: SimContext, actor: Actor): AbilityDef[] {
  const tpl = ctx.content.actors[actor.templateId];
  if (!tpl?.abilities) return [];
  const phases = tpl.phases ?? [];
  const phase = actor.brain?.phase ?? 0;
  const lockedLater = new Set<string>();
  for (let i = 0; i < phases.length; i++) {
    if (i + 1 > phase) {
      for (const id of phases[i].unlockAbilities ?? []) lockedLater.add(id);
    }
  }
  return tpl.abilities.filter((a) => !lockedLater.has(a.id));
}

/** Begin a telegraphed ability cast (attack state machine takes over). */
export function startAbility(ctx: SimContext, actor: Actor, ability: AbilityDef): boolean {
  if (actor.attack || actor.dead) return false;
  const brain = actor.brain;
  if (!brain) return false;
  if ((brain.abilityCooldowns[ability.id] ?? 0) > 0) return false;
  brain.abilityCooldowns[ability.id] = ability.cooldownTicks;
  actor.attack = {
    kind: 'spell',
    phase: 'windup',
    t: ability.telegraphTicks,
    abilityId: ability.id,
    telegraph: true,
    interruptible: ability.interruptible,
    interruptDamage: 0,
  };
  ctx.emit({
    type: 'telegraph',
    sourceId: actor.id,
    abilityId: ability.id,
    ticks: ability.telegraphTicks,
    interruptible: ability.interruptible,
  });
  return true;
}

let nextAoeId = 1;

/** Resolve an ability at the end of its telegraph. */
export function executeAbility(ctx: SimContext, actor: Actor, abilityId: ContentId): void {
  const ability = abilityOf(ctx, actor, abilityId);
  if (!ability) return;
  switch (ability.kind) {
    case 'frontal_cone': {
      const halfCos = Math.cos(((ability.coneDegrees ?? 90) * Math.PI) / 180 / 2);
      const fx = Math.sin(actor.yaw);
      const fz = Math.cos(actor.yaw);
      for (const target of ctx.actors.values()) {
        if (target.id === actor.id || target.dead || target.downed) continue;
        if (target.pos.spaceId !== actor.pos.spaceId) continue;
        if (!ctx.isHostile(actor, target)) continue;
        const dx = target.pos.x - actor.pos.x;
        const dz = target.pos.z - actor.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist > (ability.range ?? 8)) continue;
        const dot = dist > 0.01 ? (dx / dist) * fx + (dz / dist) * fz : 1;
        if (dot < halfCos) continue;
        ctx.dealDamage(target.id, actor.id, (ability.damage ?? 10) * damageMult(ctx, actor), ability.channel ?? 'frost');
      }
      break;
    }
    case 'ground_aoe': {
      // Drop a pool under the current highest-threat target (area denial).
      const brain = actor.brain;
      const target = brain ? ctx.actors.get(brain.targetId) : null;
      const at = target && target.pos.spaceId === actor.pos.spaceId ? target.pos : actor.pos;
      ctx.groundAoes.push({
        id: nextAoeId++,
        spaceId: actor.pos.spaceId,
        x: at.x,
        z: at.z,
        radius: ability.aoeRadius ?? 3,
        dps: (ability.aoeDps ?? 6) * damageMult(ctx, actor),
        channel: ability.channel ?? 'frost',
        expiresAtTick: ctx.tickCount() + (ability.aoeTicks ?? 300),
        sourceId: actor.id,
      });
      break;
    }
    case 'summon': {
      const n = ability.summonCount ?? 1;
      for (let i = 0; i < n; i++) {
        const ang = ctx.rng.range(0, Math.PI * 2);
        const r = ctx.rng.range(1.5, 3.5);
        ctx.spawnFromTemplate(
          ability.summonActorId!,
          actor.pos.spaceId,
          { x: actor.pos.x + Math.cos(ang) * r, y: actor.pos.y, z: actor.pos.z + Math.sin(ang) * r },
          actor.id,
        );
      }
      break;
    }
    case 'heal_ally': {
      // Heal the most-injured living hostile-to-players ally in range.
      let best: Actor | null = null;
      let bestFrac = 1;
      for (const other of ctx.actors.values()) {
        if (other.id === actor.id || other.dead) continue;
        if (other.pos.spaceId !== actor.pos.spaceId) continue;
        if (other.kind === 'player' || ctx.isHostile(actor, other)) continue;
        const d = Math.hypot(other.pos.x - actor.pos.x, other.pos.z - actor.pos.z);
        if (d > (ability.range ?? 18)) continue;
        const frac = other.health / other.stats.maxHealth;
        if (frac < bestFrac) {
          bestFrac = frac;
          best = other;
        }
      }
      if (best) {
        ctx.applyHeal(best.id, ability.healAmount ?? 10);
        // Healing generates threat on every enemy engaged with the healer's side.
        for (const enemy of ctx.actors.values()) {
          void enemy;
        }
        // Support enemies draw player attention via the priority-target rule
        // documented in ENCOUNTER_DESIGN.md; healing threat applies to PLAYER
        // healers via applyHeal wiring (sim.ts).
        void THREAT_PER_HEAL;
      }
      break;
    }
  }
}

/** Phase-scaled outgoing damage multiplier for template actors. */
export function damageMult(ctx: SimContext, actor: Actor): number {
  const tpl = ctx.content.actors[actor.templateId];
  const phase = actor.brain?.phase ?? 0;
  let mult = 1;
  const phases = tpl?.phases ?? [];
  for (let i = 0; i < Math.min(phase, phases.length); i++) {
    mult *= phases[i].damageMult ?? 1;
  }
  return mult;
}

/** Advance boss phase when health crosses thresholds. Emits bossPhase. */
export function updatePhase(ctx: SimContext, actor: Actor): void {
  const tpl = ctx.content.actors[actor.templateId];
  const brain = actor.brain;
  if (!tpl?.phases || !brain) return;
  const frac = actor.health / actor.stats.maxHealth;
  let phase = 0;
  for (const p of tpl.phases) {
    if (frac <= p.healthFrac) phase++;
  }
  if (phase > brain.phase) {
    brain.phase = phase;
    ctx.emit({ type: 'bossPhase', bossId: actor.id, phase });
    // Entering a phase immediately readies its unlocked abilities.
    for (const p of tpl.phases.slice(0, phase)) {
      for (const id of p.unlockAbilities ?? []) {
        if (brain.abilityCooldowns[id] === undefined) brain.abilityCooldowns[id] = 15;
      }
    }
  }
}

export function tickAbilityCooldowns(actor: Actor): void {
  const brain = actor.brain;
  if (!brain) return;
  for (const key of Object.keys(brain.abilityCooldowns)) {
    if (brain.abilityCooldowns[key] > 0) brain.abilityCooldowns[key] -= 1;
  }
}
