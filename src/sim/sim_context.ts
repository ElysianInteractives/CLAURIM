// The SimContext seam (LOCKED D-002, pattern adopted from World of ClaudeCraft):
// system modules (combat, ai, quests, inventory, ...) hold FUNCTIONS only and
// talk to the rest of the sim exclusively through this interface. State lives
// on Sim; SimContext exposes it as live views plus cross-system callbacks.
// Append-only: add members, never repurpose existing ones.

import type { Rng } from './rng';
import type {
  Actor,
  CharacterId,
  ContentId,
  EntityId,
  Projectile,
  QuestState,
  SimEvent,
  SkillId,
  SpaceId,
  Vec3,
} from './types';
import type { ContentRegistry } from './content/schema';
import type { CollisionIndex } from './world/collision';

/** A damaging ground area (boss pools, area denial). Transient combat state. */
export interface GroundAoe {
  id: number;
  spaceId: SpaceId;
  x: number;
  z: number;
  radius: number;
  dps: number;
  channel: Projectile['channel'];
  expiresAtTick: number;
  sourceId: EntityId;
}

export interface SimContext {
  // --- live primitive views (state stays on Sim) ---------------------------
  readonly content: ContentRegistry;
  readonly rng: Rng;
  readonly seed: number;
  readonly colliders: CollisionIndex;
  readonly actors: Map<EntityId, Actor>;
  readonly projectiles: Projectile[];
  readonly groundAoes: GroundAoe[];
  readonly events: SimEvent[];
  /** Game time in hours since world start (fractional). */
  gameHours(): number;
  tickCount(): number;
  /** Primary character (offline/back-compat host). MULTIPLAYER NOTE (D-013):
   * system modules must NOT use this for per-player logic; use the explicit
   * charId-parameterized members below. */
  playerId(): EntityId;
  player(): Actor;
  // --- multiplayer identity (D-013) ---------------------------------------
  playerCharIds(): CharacterId[];
  actorByCharId(charId: CharacterId): Actor | null;
  charIdOf(entityId: EntityId): CharacterId | null;
  /** Character ids in the same party as charId (including itself). */
  partyMembersOf(charId: CharacterId): CharacterId[];
  /** Per-character quest journal (created on first access). */
  questLogOf(charId: CharacterId): Map<ContentId, QuestState>;
  knownSpellsOf(charId: CharacterId): ContentId[];
  containersLootedBy(charId: CharacterId): Set<string>;
  /** Spawn an actor from a template at runtime (summons). Returns id. */
  spawnFromTemplate(templateId: ContentId, spaceId: SpaceId, pos: Vec3, summonedBy: EntityId): EntityId;
  /** Allocate an instance-owned transient ground-effect id. */
  allocateGroundAoeId(): number;

  // --- cross-system callbacks ----------------------------------------------
  emit(e: SimEvent): void;
  /** Combat: authoritative damage entry point. */
  dealDamage(
    targetId: EntityId,
    sourceId: EntityId,
    amount: number,
    channel: Projectile['channel'],
    blockable?: boolean,
    blockOrigin?: Vec3,
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
  /** Encounter lifecycle (D-018/D-021). */
  resetEncounter(bossId: EntityId): void;
  /** Whether AI should tick for an actor (streaming activity window). */
  isActorActive(a: Actor): boolean;
  /** Hostility between two actors (faction/crime aware). */
  isHostile(a: Actor, b: Actor): boolean;
  /** Space-aware ground height. */
  ground(spaceId: SpaceId, x: number, z: number): number;
  /** Earliest world obstruction along a projectile step, if any. */
  projectileObstruction(spaceId: SpaceId, from: Vec3, to: Vec3): number | null;
}
