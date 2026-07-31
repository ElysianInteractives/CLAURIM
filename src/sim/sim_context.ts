// The SimContext seam (LOCKED D-002, pattern adopted from World of ClaudeCraft):
// system modules (combat, ai, quests, inventory, ...) hold FUNCTIONS only and
// talk to the rest of the sim exclusively through this interface. State lives
// on Sim; SimContext exposes it as live views plus cross-system callbacks.
// Append-only: add members, never repurpose existing ones.

import type { Rng } from './rng';
import type {
  Actor,
  ContentId,
  EntityId,
  Projectile,
  QuestState,
  SimEvent,
  SkillId,
  SpaceId,
} from './types';
import type { ContentRegistry } from './content/schema';
import type { CollisionIndex } from './world/collision';

export interface SimContext {
  // --- live primitive views (state stays on Sim) ---------------------------
  readonly content: ContentRegistry;
  readonly rng: Rng;
  readonly seed: number;
  readonly colliders: CollisionIndex;
  readonly actors: Map<EntityId, Actor>;
  readonly projectiles: Projectile[];
  readonly quests: Map<ContentId, QuestState>;
  readonly events: SimEvent[];
  /** Game time in hours since world start (fractional). */
  gameHours(): number;
  playerId(): EntityId;
  player(): Actor;

  // --- cross-system callbacks ----------------------------------------------
  emit(e: SimEvent): void;
  /** Combat: authoritative damage entry point. */
  dealDamage(
    targetId: EntityId,
    sourceId: EntityId,
    amount: number,
    channel: Projectile['channel'],
  ): void;
  applyHeal(targetId: EntityId, amount: number): void;
  applyEffect(targetId: EntityId, effectId: ContentId, source: string): void;
  recalcStats(actorId: EntityId): void;
  /** Inventory. */
  addItem(actorId: EntityId, itemId: ContentId, count: number): void;
  removeItem(actorId: EntityId, itemId: ContentId, count: number): boolean;
  countItem(actorId: EntityId, itemId: ContentId): number;
  /** Progression: use-based skill xp. */
  trainSkill(actorId: EntityId, skill: SkillId, xp: number): void;
  /** Quest credit feed. */
  onQuestEvent(e: SimEvent): void;
  /** Whether AI should tick for an actor (streaming activity window). */
  isActorActive(a: Actor): boolean;
  /** Hostility between two actors (faction/crime aware). */
  isHostile(a: Actor, b: Actor): boolean;
  /** Space-aware ground height. */
  ground(spaceId: SpaceId, x: number, z: number): number;
}
