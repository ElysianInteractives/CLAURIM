// NPC/creature AI: perception (distance + vision cone + stealth), the state
// machine (idle/schedule <-> combat <-> search <-> flee <-> return), schedule
// packages, and combat positioning for melee vs ranged archetypes. Full
// decisions use the streaming activity window; cooldown/threat maintenance
// and valid offscreen schedule advancement remain resident.

import {
  DT,
  ENGAGE_RADIUS,
  MELEE_RANGE,
  THREAT_DECAY_PER_SEC,
  THREAT_SWITCH_FACTOR,
  type Actor,
  type EntityId,
  type Vec3,
} from '../types';
import type { SimContext } from '../sim_context';
import type { CollisionIndex } from '../world/collision';
import { nearestTraversablePoint, resolveMove } from '../world/collision';
import { findPath, lineWalkable } from '../navigation/navgrid';
import { startMelee, startRanged } from '../combat/combat';
import {
  availableAbilities,
  canUseAbility,
  startAbility,
  tickAbilityCooldowns,
  updatePhase,
} from './abilities';
import type { ContentRegistry } from '../content/schema';
import { encounterMembers } from './encounters';
import { currentScheduleEntry, findDoorRoute } from './schedules';

const SEARCH_SECONDS = 8;
const ATTACK_PAUSE_TICKS_MIN = 12;
const ATTACK_PAUSE_TICKS_MAX = 30;
const RANGED_PREFERRED_DIST = 14;
const ARRIVE_DIST = 0.8;
const LEASH_DIST = 70;
const RETURN_RECOVERY_TICKS = 90;
const SCHEDULE_RECOVERY_TICKS = 60;

type MoveResult = 'arrived' | 'moving' | 'blocked';

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
    stuckTicks: 0,
    scheduleKey: null,
    scheduleGoal: null,
    alertness: 0,
    threat: {},
    scaledFor: 0,
    abilityCooldowns: {},
    phase: 0,
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
  const clearLineOfSight =
    ctx.projectileObstruction(
      observer.pos.spaceId,
      { x: observer.pos.x, y: observer.pos.y + 1.2, z: observer.pos.z },
      { x: target.pos.x, y: target.pos.y + 1.2, z: target.pos.z },
    ) === null;
  if (!clearLineOfSight) return false;
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
  requireCompleteRoute = false,
): MoveResult {
  const brain = a.brain!;
  const dx = goal.x - a.pos.x;
  const dz = goal.z - a.pos.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist < ARRIVE_DIST) {
    brain.path = null;
    brain.stuckTicks = 0;
    return 'arrived';
  }

  // Use straight-line movement when clear; otherwise follow / compute a path.
  let stepGoal = goal;
  const directRoute = lineWalkable(content, colliders, a.pos.spaceId, a.pos, goal, ctx.seed);
  if (!directRoute) {
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
    // A traversable endpoint is not enough for static schedule/return goals.
    // Collision sliding is not pathfinding and previously prevented their
    // stuck recovery (D-038). Combat/search retain existing local steering.
    if (!brain.path && requireCompleteRoute) {
      brain.stuckTicks++;
      return 'blocked';
    }
  } else {
    brain.path = null;
  }

  const sdx = stepGoal.x - a.pos.x;
  const sdz = stepGoal.z - a.pos.z;
  const sdist = Math.hypot(sdx, sdz);
  const beforeX = a.pos.x;
  const beforeZ = a.pos.z;
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
  if (Math.hypot(a.pos.x - beforeX, a.pos.z - beforeZ) < 0.001) {
    brain.stuckTicks++;
    return 'blocked';
  }
  brain.stuckTicks = 0;
  return 'moving';
}

// ---------------------------------------------------------------------------
// Threat + encounter helpers (D-017 / D-018)
// ---------------------------------------------------------------------------

/** Highest-threat valid target with hysteresis, except that an unseen current
 * target yields immediately to the highest-threat target actually perceived. */
function selectThreatTarget(ctx: SimContext, a: Actor): EntityId {
  const brain = a.brain!;
  let bestId = 0;
  let bestThreat = -1;
  for (const [idStr, threat] of Object.entries(brain.threat)) {
    const id = Number(idStr);
    const cand = ctx.actors.get(id);
    if (!cand || cand.dead || cand.downed) continue;
    if (cand.pos.spaceId !== a.pos.spaceId) continue;
    if (threat > bestThreat) {
      bestThreat = threat;
      bestId = id;
    }
  }
  const current = ctx.actors.get(brain.targetId);
  const currentValid = current && !current.dead && !current.downed && current.pos.spaceId === a.pos.spaceId;
  if (!currentValid) return bestId;
  if (!canPerceive(ctx, a, current)) {
    let visibleId = 0;
    let visibleThreat = -1;
    for (const [idStr, threat] of Object.entries(brain.threat)) {
      const candidate = ctx.actors.get(Number(idStr));
      if (!candidate || !canPerceive(ctx, a, candidate)) continue;
      if (threat > visibleThreat) {
        visibleThreat = threat;
        visibleId = candidate.id;
      }
    }
    if (visibleId !== 0) return visibleId;
  }
  const currentThreat = brain.threat[brain.targetId] ?? 0;
  // Switch only when a rival meaningfully out-threatens the current target.
  if (bestId !== brain.targetId && bestThreat > currentThreat * THREAT_SWITCH_FACTOR) return bestId;
  return brain.targetId;
}

function decayThreat(a: Actor): void {
  const brain = a.brain!;
  const decay = 1 - THREAT_DECAY_PER_SEC * DT;
  for (const key of Object.keys(brain.threat)) {
    brain.threat[key as unknown as number] *= decay;
    if (brain.threat[key as unknown as number] < 0.5) delete brain.threat[key as unknown as number];
  }
}

function scaleForEngagement(ctx: SimContext, actor: Actor, partySize: number): void {
  const brain = actor.brain!;
  if (brain.scaledFor !== 0) return;
  brain.scaledFor = partySize;
  const healthFrac = actor.stats.maxHealth > 0 ? actor.health / actor.stats.maxHealth : 1;
  ctx.recalcStats(actor.id);
  actor.health = actor.stats.maxHealth * healthFrac;
}

/** Lock encounter scaling to the engaged party size and pull every authored
 * member, including actors placed by separate spawners, into the same fight. */
function engage(ctx: SimContext, a: Actor, targetId: EntityId): void {
  const brain = a.brain!;
  brain.state = 'combat';
  brain.targetId = targetId;
  brain.threat[targetId] = Math.max(brain.threat[targetId] ?? 0, 5);

  const targetCharId = ctx.charIdOf(targetId);
  const eligibleCharacters = targetCharId ? ctx.partyMembersOf(targetCharId) : ctx.playerCharIds();
  let nearbyPlayers = 0;
  for (const charId of eligibleCharacters) {
    const player = ctx.actorByCharId(charId);
    if (!player || player.dead || player.pos.spaceId !== a.pos.spaceId) continue;
    if (Math.hypot(player.pos.x - a.pos.x, player.pos.z - a.pos.z) <= ENGAGE_RADIUS) {
      nearbyPlayers++;
    }
  }
  const partySize = brain.scaledFor || Math.max(1, nearbyPlayers);
  scaleForEngagement(ctx, a, partySize);

  for (const ally of encounterMembers(ctx.content, ctx.actors, a)) {
    if (ally.id === a.id || ally.dead || !ally.brain) continue;
    if (ally.pos.spaceId !== a.pos.spaceId) continue;
    ally.brain.threat[targetId] = Math.max(ally.brain.threat[targetId] ?? 0, 3);
    if (ally.brain.state !== 'combat') {
      ally.brain.state = 'combat';
      ally.brain.targetId = targetId;
    }
    scaleForEngagement(ctx, ally, partySize);
  }
}

function continueEncounterSearch(ctx: SimContext, actor: Actor): boolean {
  const brain = actor.brain!;
  for (const member of encounterMembers(ctx.content, ctx.actors, actor)) {
    if (
      member.id === actor.id ||
      member.dead ||
      member.brain?.state !== 'combat'
    ) {
      continue;
    }
    const target = ctx.actors.get(member.brain.targetId);
    if (
      !target ||
      target.dead ||
      target.downed ||
      target.pos.spaceId !== actor.pos.spaceId ||
      !ctx.isHostile(actor, target)
    ) {
      continue;
    }
    brain.state = 'search';
    brain.targetId = target.id;
    brain.threat[target.id] = Math.max(brain.threat[target.id] ?? 0, 1);
    brain.lastKnownPos = member.brain.lastKnownPos
      ? { ...member.brain.lastKnownPos }
      : { ...target.pos };
    brain.timer = Math.round(SEARCH_SECONDS / DT);
    return true;
  }
  return false;
}

function beginReturn(ctx: SimContext, anchor: Actor): void {
  for (const member of encounterMembers(ctx.content, ctx.actors, anchor)) {
    if (member.dead || !member.brain) continue;
    member.brain.state = 'return';
    member.brain.targetId = 0;
    member.brain.lastKnownPos = null;
    member.brain.threat = {};
    member.brain.path = null;
    member.brain.pathIdx = 0;
    member.brain.repathCooldown = 0;
    member.brain.stuckTicks = 0;
    member.attack = null;
  }
}

// ---------------------------------------------------------------------------
// The state machine
// ---------------------------------------------------------------------------

export function tickBrain(ctx: SimContext, actorId: EntityId): void {
  const a = ctx.actors.get(actorId);
  if (!a || a.dead || !a.brain) return;
  const brain = a.brain;
  const content = ctx.content;
  const colliders = ctx.colliders;
  tickAbilityCooldowns(a);
  decayThreat(a);

  const scheduled = currentScheduleEntry(content, a, ctx.gameHours());
  if (brain.state === 'idle' || brain.state === 'schedule') {
    const key = scheduled
      ? `${scheduled.fromHour}:${scheduled.toHour}:${scheduled.spaceId}:${scheduled.x}:${scheduled.z}:${scheduled.activity}`
      : null;
    if (brain.scheduleKey !== key) {
      brain.scheduleKey = key;
      brain.scheduleGoal = null;
      brain.path = null;
      brain.pathIdx = 0;
      brain.repathCooldown = 0;
      brain.stuckTicks = 0;
    }
  }
  if (!ctx.isActorActive(a)) {
    if (
      scheduled &&
      (brain.state === 'idle' || brain.state === 'schedule') &&
      scheduled.spaceId !== a.pos.spaceId &&
      findDoorRoute(content, a.pos.spaceId, scheduled.spaceId)
    ) {
      const destination = nearestTraversablePoint(
        content,
        colliders,
        scheduled.spaceId,
        scheduled.x,
        scheduled.z,
        ctx.seed,
      );
      if (destination) {
        a.pos = { spaceId: scheduled.spaceId, ...destination };
        brain.homePos = { ...a.pos };
        brain.state = 'schedule';
        brain.path = null;
        brain.stuckTicks = 0;
        brain.scheduleGoal = null;
      }
    }
    return;
  }
  if (brain.repathCooldown > 0) brain.repathCooldown--;
  if (a.attack) return; // committed to a swing

  const tpl = content.actors[a.templateId];

  // Perception scan: hostiles only (aggressive actors scan for every hostile
  // actor including all player characters; villagers only fight back via
  // damage-event threat).
  if (brain.state === 'idle' || brain.state === 'schedule' || brain.state === 'search') {
    if (tpl?.aggressive) {
      for (const other of ctx.actors.values()) {
        if (other.id === a.id || other.dead || other.downed) continue;
        if (!ctx.isHostile(a, other)) continue;
        if (canPerceive(ctx, a, other)) {
          engage(ctx, a, other.id);
          brain.lastKnownPos = { ...other.pos };
          break;
        }
      }
    }
  }

  switch (brain.state) {
    case 'idle':
    case 'schedule': {
      const entry = scheduled;
      if (entry && entry.spaceId !== a.pos.spaceId) {
        const route = findDoorRoute(content, a.pos.spaceId, entry.spaceId);
        const door = route?.[0];
        if (door) {
          brain.state = 'schedule';
          if (moveToward(ctx, content, colliders, a, door, true) === 'arrived') {
            const arrival = nearestTraversablePoint(
              content,
              colliders,
              door.targetSpaceId,
              door.targetX,
              door.targetZ,
              ctx.seed,
            );
            if (arrival) {
              a.pos = { spaceId: door.targetSpaceId, ...arrival };
              a.yaw = door.targetYaw;
              brain.path = null;
              brain.stuckTicks = 0;
              brain.scheduleGoal = null;
            }
          }
        }
      } else if (entry) {
        brain.state = 'schedule';
        let goal: { x: number; z: number } = brain.scheduleGoal ?? entry;
        if (entry.activity === 'wander') {
          // Deterministic wander: drift around the anchor using sim rng, retarget on timer.
          if (brain.timer <= 0) {
            brain.timer = ctx.rng.int(90, 240);
            brain.lastKnownPos = {
              x: entry.x + ctx.rng.range(-8, 8),
              y: 0,
              z: entry.z + ctx.rng.range(-8, 8),
            };
            brain.scheduleGoal = null;
          }
          brain.timer--;
          if (!brain.scheduleGoal && brain.lastKnownPos) goal = brain.lastKnownPos;
        }
        const move = moveToward(ctx, content, colliders, a, goal, true);
        if (move === 'arrived') {
          brain.homePos = { ...a.pos };
        } else if (move === 'blocked' && brain.stuckTicks >= SCHEDULE_RECOVERY_TICKS) {
          // Fall back to the last schedule point the NPC actually reached.
          // This is a stable, known-good location and remains the substitute
          // only until the authored entry (or wander timer) changes.
          const safe = brain.homePos.spaceId === a.pos.spaceId
            ? nearestTraversablePoint(
              content,
              colliders,
              a.pos.spaceId,
              brain.homePos.x,
              brain.homePos.z,
              ctx.seed,
            )
            : null;
          brain.scheduleGoal = safe ?? { x: a.pos.x, y: a.pos.y, z: a.pos.z };
          brain.path = null;
          brain.pathIdx = 0;
          brain.repathCooldown = 0;
          brain.stuckTicks = 0;
        }
      }
      break;
    }

    case 'combat': {
      updatePhase(ctx, a);
      // Threat-based target selection with hysteresis (D-017).
      brain.targetId = selectThreatTarget(ctx, a);
      const target = ctx.actors.get(brain.targetId);
      if (!target || target.dead || target.downed) {
        // No valid threat left: everyone is dead, downed, or gone.
        beginReturn(ctx, a);
        break;
      }
      engage(ctx, a, target.id);
      // Leash.
      if (Math.hypot(a.pos.x - brain.homePos.x, a.pos.z - brain.homePos.z) > LEASH_DIST) {
        beginReturn(ctx, a);
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
      // Template abilities: elites/bosses/supports prefer a ready ability.
      const abilities = availableAbilities(ctx, a);
      if (abilities.length > 0 && brain.timer <= 0) {
        for (const ability of abilities) {
          if (!canUseAbility(ctx, a, ability)) continue;
          if (ability.kind === 'frontal_cone' || ability.kind === 'ground_aoe') {
            a.yaw = Math.atan2(target.pos.x - a.pos.x, target.pos.z - a.pos.z);
          }
          if (startAbility(ctx, a, ability)) {
            brain.timer = ctx.rng.int(ATTACK_PAUSE_TICKS_MIN, ATTACK_PAUSE_TICKS_MAX);
            break;
          }
        }
        if (a.attack) break;
      }
      const dx = target.pos.x - a.pos.x;
      const dz = target.pos.z - a.pos.z;
      const dist = Math.hypot(dx, dz);
      const role = tpl?.role ?? (tpl?.attack === 'ranged' ? 'ranged' : 'melee');
      if (role === 'support') {
        // Supports hang back and rely on their abilities (heals). Keep range.
        a.yaw = Math.atan2(dx, dz);
        if (dist < 10) {
          const away = { x: a.pos.x - dx, z: a.pos.z - dz };
          moveToward(ctx, content, colliders, a, away);
        } else if (dist > 24) {
          moveToward(ctx, content, colliders, a, target.pos);
        }
        if (brain.timer > 0) brain.timer--;
        break;
      }
      const ranged = role === 'ranged';
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
        if (!continueEncounterSearch(ctx, a)) beginReturn(ctx, a);
        break;
      }
      brain.timer--;
      const move = moveToward(ctx, content, colliders, a, brain.lastKnownPos);
      // Re-acquire if the target becomes visible again (scan above handles it).
      if (move === 'arrived') {
        // Look around: rotate deterministically.
        a.yaw += 1.5 * DT;
      }
      break;
    }

    case 'flee': {
      const target = ctx.actors.get(brain.targetId);
      if (!target || target.dead || Math.hypot(target.pos.x - a.pos.x, target.pos.z - a.pos.z) > 40) {
        if (!continueEncounterSearch(ctx, a)) beginReturn(ctx, a);
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
      const move = moveToward(ctx, content, colliders, a, brain.homePos, true);
      if (move === 'arrived') {
        ctx.resetEncounter(a.id);
      } else if (move === 'blocked' && brain.stuckTicks >= RETURN_RECOVERY_TICKS) {
        const home = nearestTraversablePoint(
          content,
          colliders,
          brain.homePos.spaceId,
          brain.homePos.x,
          brain.homePos.z,
          ctx.seed,
        );
        if (home) {
          a.pos = { spaceId: brain.homePos.spaceId, ...home };
          ctx.resetEncounter(a.id);
        }
      }
      break;
    }

    case 'dead':
      break;
  }
}
