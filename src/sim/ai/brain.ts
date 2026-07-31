// NPC/creature AI: perception (distance + vision cone + stealth), the state
// machine (idle/schedule <-> combat <-> search <-> flee <-> return), schedule
// packages, and combat positioning for melee vs ranged archetypes.
// Ticks only for actors inside the streaming activity window.

import {
  DT,
  MELEE_RANGE,
  type Actor,
  type EntityId,
  type Vec3,
} from '../types';
import type { SimContext } from '../sim_context';
import type { CollisionIndex } from '../world/collision';
import { resolveMove } from '../world/collision';
import { findPath, lineWalkable } from '../navigation/navgrid';
import { startMelee, startRanged } from '../combat/combat';
import type { ContentRegistry, ScheduleEntry } from '../content/schema';

const SEARCH_SECONDS = 8;
const ATTACK_PAUSE_TICKS_MIN = 12;
const ATTACK_PAUSE_TICKS_MAX = 30;
const RANGED_PREFERRED_DIST = 14;
const ARRIVE_DIST = 0.8;
const LEASH_DIST = 70;

export function makeBrain(home: Actor['pos']): NonNullable<Actor['brain']> {
  return {
    state: 'idle',
    targetId: 0,
    lastKnownPos: null,
    timer: 0,
    homePos: { ...home },
    path: null,
    pathIdx: 0,
    repathCooldown: 0,
    alertness: 0,
  };
}

// ---------------------------------------------------------------------------
// Perception
// ---------------------------------------------------------------------------

/** Can `observer` detect `target` this tick? Deterministic; stealth reduces
 * effective range, vision cone applies unless very close, night reduces range
 * outdoors. */
export function canPerceive(ctx: SimContext, observer: Actor, target: Actor): boolean {
  if (target.dead) return false;
  if (observer.pos.spaceId !== target.pos.spaceId) return false;
  const tpl = ctx.content.actors[observer.templateId];
  let range = tpl?.perceptionRange ?? 20;

  // Night: outdoor perception drops 35% between 21:00 and 05:00.
  const hour = ctx.gameHours() % 24;
  const exterior = ctx.content.spaces[observer.pos.spaceId]?.kind === 'exterior';
  if (exterior && (hour >= 21 || hour < 5)) range *= 0.65;

  if (target.sneaking) {
    const stealthFactor = Math.max(0.15, 1 - target.stats.stealth * 0.12);
    range *= stealthFactor * observer.stats.detection;
  }

  const dx = target.pos.x - observer.pos.x;
  const dz = target.pos.z - observer.pos.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist > range) return false;
  // Touch range bypasses the vision cone, but a sneaking target can get much
  // closer before being noticed (backstab window).
  if (dist < (target.sneaking ? 1.0 : 2.5)) return true;

  // Vision cone: 140 degrees.
  const fx = Math.sin(observer.yaw);
  const fz = Math.cos(observer.yaw);
  const dot = (dx / dist) * fx + (dz / dist) * fz;
  return dot > Math.cos((140 * Math.PI) / 180 / 2);
}

// ---------------------------------------------------------------------------
// Movement helpers
// ---------------------------------------------------------------------------

function moveToward(
  ctx: SimContext,
  content: ContentRegistry,
  colliders: CollisionIndex,
  a: Actor,
  goal: { x: number; z: number },
): boolean {
  const brain = a.brain!;
  const dx = goal.x - a.pos.x;
  const dz = goal.z - a.pos.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist < ARRIVE_DIST) {
    brain.path = null;
    return true;
  }

  // Use straight-line movement when clear; otherwise follow / compute a path.
  let stepGoal = goal;
  if (!lineWalkable(content, colliders, a.pos.spaceId, a.pos, goal, ctx.seed)) {
    if (!brain.path && brain.repathCooldown <= 0) {
      brain.path = findPath(content, colliders, a.pos.spaceId, a.pos, goal, ctx.seed);
      brain.pathIdx = 0;
      brain.repathCooldown = 30; // 1s between repaths
    }
    if (brain.path) {
      while (
        brain.pathIdx < brain.path.length &&
        Math.hypot(brain.path[brain.pathIdx].x - a.pos.x, brain.path[brain.pathIdx].z - a.pos.z) < ARRIVE_DIST
      ) {
        brain.pathIdx++;
      }
      if (brain.pathIdx >= brain.path.length) {
        brain.path = null;
      } else {
        stepGoal = brain.path[brain.pathIdx];
      }
    }
  } else {
    brain.path = null;
  }

  const sdx = stepGoal.x - a.pos.x;
  const sdz = stepGoal.z - a.pos.z;
  const sdist = Math.hypot(sdx, sdz);
  if (sdist > 0.01) {
    a.yaw = Math.atan2(sdx, sdz);
    const step = a.stats.moveSpeed * DT;
    const moved = resolveMove(
      content,
      colliders,
      a.pos.spaceId,
      a.pos,
      (sdx / sdist) * step,
      (sdz / sdist) * step,
      ctx.seed,
    );
    a.pos.x = moved.x;
    a.pos.y = moved.y;
    a.pos.z = moved.z;
  }
  return false;
}

function currentScheduleEntry(ctx: SimContext, a: Actor): ScheduleEntry | null {
  const tpl = ctx.content.actors[a.templateId];
  if (!tpl?.schedule || tpl.schedule.length === 0) return null;
  const hour = ctx.gameHours() % 24;
  for (const e of tpl.schedule) {
    if (hour >= e.fromHour && hour < e.toHour) return e;
  }
  return tpl.schedule[0];
}

// ---------------------------------------------------------------------------
// The state machine
// ---------------------------------------------------------------------------

export function tickBrain(ctx: SimContext, actorId: EntityId): void {
  const a = ctx.actors.get(actorId);
  if (!a || a.dead || !a.brain) return;
  if (!ctx.isActorActive(a)) return;
  const brain = a.brain;
  const content = ctx.content;
  const colliders = ctx.colliders;
  if (brain.repathCooldown > 0) brain.repathCooldown--;
  if (a.attack) return; // committed to a swing

  const tpl = content.actors[a.templateId];

  // Perception scan: hostiles only (aggressive actors scan for the player and
  // opposing factions; villagers only fight back via damage events).
  if (brain.state === 'idle' || brain.state === 'schedule' || brain.state === 'search') {
    if (tpl?.aggressive) {
      for (const other of ctx.actors.values()) {
        if (other.id === a.id || other.dead) continue;
        if (!ctx.isHostile(a, other)) continue;
        if (canPerceive(ctx, a, other)) {
          brain.state = 'combat';
          brain.targetId = other.id;
          brain.lastKnownPos = { ...other.pos };
          break;
        }
      }
    }
  }

  switch (brain.state) {
    case 'idle':
    case 'schedule': {
      const entry = currentScheduleEntry(ctx, a);
      if (entry && entry.spaceId === a.pos.spaceId) {
        brain.state = 'schedule';
        let goal: { x: number; z: number } = entry;
        if (entry.activity === 'wander') {
          // Deterministic wander: drift around the anchor using sim rng, retarget on timer.
          if (brain.timer <= 0) {
            brain.timer = ctx.rng.int(90, 240);
            brain.lastKnownPos = {
              x: entry.x + ctx.rng.range(-8, 8),
              y: 0,
              z: entry.z + ctx.rng.range(-8, 8),
            };
          }
          brain.timer--;
          if (brain.lastKnownPos) goal = brain.lastKnownPos;
        }
        moveToward(ctx, content, colliders, a, goal);
      }
      // NOTE: cross-space schedule travel is teleport-on-arrival-window for the
      // slice (KL-4): NPCs whose schedule entry is in another space stay put.
      break;
    }

    case 'combat': {
      const target = ctx.actors.get(brain.targetId);
      if (!target || target.dead) {
        brain.state = 'return';
        brain.targetId = 0;
        break;
      }
      // Leash.
      if (Math.hypot(a.pos.x - brain.homePos.x, a.pos.z - brain.homePos.z) > LEASH_DIST) {
        brain.state = 'return';
        brain.targetId = 0;
        break;
      }
      // Flee check.
      if (tpl && tpl.fleeBelowHealthFrac > 0 && a.health / a.stats.maxHealth < tpl.fleeBelowHealthFrac) {
        brain.state = 'flee';
        break;
      }
      const visible = canPerceive(ctx, a, target) || Math.hypot(target.pos.x - a.pos.x, target.pos.z - a.pos.z) < 6;
      if (visible) {
        brain.lastKnownPos = { ...target.pos };
      } else {
        brain.state = 'search';
        brain.timer = Math.round(SEARCH_SECONDS / DT);
        break;
      }
      const dx = target.pos.x - a.pos.x;
      const dz = target.pos.z - a.pos.z;
      const dist = Math.hypot(dx, dz);
      const ranged = tpl?.attack === 'ranged';
      if (ranged) {
        a.yaw = Math.atan2(dx, dz);
        if (dist > RANGED_PREFERRED_DIST + 6) {
          moveToward(ctx, content, colliders, a, target.pos);
        } else if (dist < RANGED_PREFERRED_DIST - 6) {
          // Back away.
          const away = { x: a.pos.x - dx, z: a.pos.z - dz };
          moveToward(ctx, content, colliders, a, away);
        } else if (brain.timer <= 0 && lineWalkable(content, colliders, a.pos.spaceId, a.pos, target.pos, ctx.seed)) {
          startRanged(ctx, a.id);
          brain.timer = ctx.rng.int(ATTACK_PAUSE_TICKS_MIN * 2, ATTACK_PAUSE_TICKS_MAX * 2);
        }
      } else {
        if (dist > MELEE_RANGE * 0.8) {
          moveToward(ctx, content, colliders, a, target.pos);
        } else {
          a.yaw = Math.atan2(dx, dz);
          if (brain.timer <= 0) {
            startMelee(ctx, a.id);
            brain.timer = ctx.rng.int(ATTACK_PAUSE_TICKS_MIN, ATTACK_PAUSE_TICKS_MAX);
          }
        }
      }
      if (brain.timer > 0) brain.timer--;
      break;
    }

    case 'search': {
      if (brain.timer <= 0 || !brain.lastKnownPos) {
        brain.state = 'return';
        break;
      }
      brain.timer--;
      const arrived = moveToward(ctx, content, colliders, a, brain.lastKnownPos);
      // Re-acquire if the target becomes visible again (scan above handles it).
      if (arrived) {
        // Look around: rotate deterministically.
        a.yaw += 1.5 * DT;
      }
      break;
    }

    case 'flee': {
      const target = ctx.actors.get(brain.targetId);
      if (!target || target.dead || Math.hypot(target.pos.x - a.pos.x, target.pos.z - a.pos.z) > 40) {
        brain.state = 'return';
        break;
      }
      const away = {
        x: a.pos.x + (a.pos.x - target.pos.x),
        z: a.pos.z + (a.pos.z - target.pos.z),
      };
      moveToward(ctx, content, colliders, a, away);
      break;
    }

    case 'return': {
      const arrived = moveToward(ctx, content, colliders, a, brain.homePos);
      if (arrived) {
        brain.state = 'idle';
        brain.targetId = 0;
        brain.lastKnownPos = null;
        // Out-of-combat recovery.
        a.health = Math.min(a.stats.maxHealth, a.health + a.stats.maxHealth * 0.5);
      }
      break;
    }

    case 'dead':
      break;
  }
}
