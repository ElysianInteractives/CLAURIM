// Data-driven enemy abilities (D-018): telegraphed frontal cones, ground
// pools, summons, and ally heals, defined on ActorTemplate.abilities and
// gated by phases. This is the reusable mechanic system every elite/boss
// uses; the Pale Warden is the exemplar (content/actors.ts).

import type { Actor, ContentId } from '../types';
import type { SimContext } from '../sim_context';
import type { AbilityDef } from '../content/schema';
import { encounterMembers } from './encounters';

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

function hostileTarget(ctx: SimContext, actor: Actor): Actor | null {
  const target = actor.brain ? ctx.actors.get(actor.brain.targetId) : null;
  if (!target || target.dead || target.downed) return null;
  if (target.pos.spaceId !== actor.pos.spaceId || !ctx.isHostile(actor, target)) return null;
  return target;
}

function hasLineOfSight(ctx: SimContext, actor: Actor, target: Actor): boolean {
  return (
    ctx.projectileObstruction(
      actor.pos.spaceId,
      { x: actor.pos.x, y: actor.pos.y + 1.2, z: actor.pos.z },
      { x: target.pos.x, y: target.pos.y + 1.2, z: target.pos.z },
    ) === null
  );
}

function mostInjuredAlly(
  ctx: SimContext,
  actor: Actor,
  range: number,
): Actor | null {
  let best: Actor | null = null;
  let bestFrac = 1;
  for (const other of encounterMembers(ctx.content, ctx.actors, actor)) {
    if (other.id === actor.id || other.dead || other.downed) continue;
    if (other.pos.spaceId !== actor.pos.spaceId || ctx.isHostile(actor, other)) continue;
    if (Math.hypot(other.pos.x - actor.pos.x, other.pos.z - actor.pos.z) > range) continue;
    const frac = other.stats.maxHealth > 0 ? other.health / other.stats.maxHealth : 1;
    if (frac < bestFrac) {
      bestFrac = frac;
      best = other;
    }
  }
  return best;
}

function livingSummonCount(ctx: SimContext, actor: Actor): number {
  return [...ctx.actors.values()].filter(
    (candidate) => candidate.summonedBy === actor.id && !candidate.dead,
  ).length;
}

/** Whether a ready ability has a legal, useful target right now. */
export function canUseAbility(
  ctx: SimContext,
  actor: Actor,
  ability: AbilityDef,
): boolean {
  if (actor.attack || actor.dead || !actor.brain) return false;
  if ((actor.brain.abilityCooldowns[ability.id] ?? 0) > 0) return false;
  if (ability.kind === 'heal_ally') {
    return mostInjuredAlly(ctx, actor, ability.range ?? 18) !== null;
  }
  if (ability.kind === 'summon') {
    return livingSummonCount(ctx, actor) < (ability.maxActiveSummons ?? Number.POSITIVE_INFINITY);
  }
  const target = hostileTarget(ctx, actor);
  if (!target) return false;
  const distance = Math.hypot(target.pos.x - actor.pos.x, target.pos.z - actor.pos.z);
  if (ability.kind === 'frontal_cone') {
    return distance <= (ability.range ?? 8) && hasLineOfSight(ctx, actor, target);
  }
  const targetRange =
    ability.range ?? ctx.content.actors[actor.templateId]?.perceptionRange ?? 30;
  return distance <= targetRange && hasLineOfSight(ctx, actor, target);
}

/** Begin a telegraphed ability cast (attack state machine takes over). */
export function startAbility(ctx: SimContext, actor: Actor, ability: AbilityDef): boolean {
  if (actor.attack || actor.dead || !actor.brain) return false;
  const brain = actor.brain;
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
      const target = hostileTarget(ctx, actor);
      if (!target) break;
      ctx.groundAoes.push({
        id: ctx.allocateGroundAoeId(),
        spaceId: actor.pos.spaceId,
        x: target.pos.x,
        z: target.pos.z,
        radius: ability.aoeRadius ?? 3,
        dps: (ability.aoeDps ?? 6) * damageMult(ctx, actor),
        channel: ability.channel ?? 'frost',
        expiresAtTick: ctx.tickCount() + (ability.aoeTicks ?? 300),
        sourceId: actor.id,
      });
      break;
    }
    case 'summon': {
      const remaining = Math.max(
        0,
        (ability.maxActiveSummons ?? Number.POSITIVE_INFINITY) -
          livingSummonCount(ctx, actor),
      );
      const n = Math.min(ability.summonCount ?? 1, remaining);
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
      const best = mostInjuredAlly(ctx, actor, ability.range ?? 18);
      if (best) {
        ctx.applyHeal(best.id, ability.healAmount ?? 10);
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
