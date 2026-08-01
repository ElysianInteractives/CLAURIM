// Deterministic encounter ownership shared by AI aggro, wipe/reset handling,
// transient mechanics, and summons. Authored encounterId joins spawners into
// one pull; legacy content falls back to its individual spawner.

import type { Actor, EntityId } from '../types';
import type { ContentRegistry } from '../content/schema';

function summonRoot(actors: ReadonlyMap<EntityId, Actor>, actor: Actor): Actor {
  let current = actor;
  const seen = new Set<EntityId>();
  while (current.summonedBy !== 0 && !seen.has(current.id)) {
    seen.add(current.id);
    const owner = actors.get(current.summonedBy);
    if (!owner) break;
    current = owner;
  }
  return current;
}

/** Stable ownership key for an actor and every summon descended from it. */
export function encounterKeyForActor(
  content: ContentRegistry,
  actors: ReadonlyMap<EntityId, Actor>,
  actor: Actor,
): string {
  const root = summonRoot(actors, actor);
  if (root.spawnerId) {
    const spawner = content.spawners.find((candidate) => candidate.id === root.spawnerId);
    if (spawner?.encounterId) return `encounter:${spawner.encounterId}`;
    return `spawner:${root.spawnerId}`;
  }
  return `actor:${root.id}`;
}

/** All actors owned by the same authored encounter, including descendants. */
export function encounterMembers(
  content: ContentRegistry,
  actors: ReadonlyMap<EntityId, Actor>,
  anchor: Actor,
): Actor[] {
  const key = encounterKeyForActor(content, actors, anchor);
  return [...actors.values()].filter(
    (candidate) => encounterKeyForActor(content, actors, candidate) === key,
  );
}

/** Authored encounter ids may safely revive preplaced members on a wipe. */
export function hasAuthoredEncounter(content: ContentRegistry, actor: Actor): boolean {
  if (!actor.spawnerId) return false;
  return Boolean(
    content.spawners.find((candidate) => candidate.id === actor.spawnerId)?.encounterId,
  );
}
