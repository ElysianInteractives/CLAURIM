// Read facet: everything the renderer/UI may observe. Pure data out.

import type {
  ContentId,
  EntityId,
  SimEvent,
  SkillId,
  SpaceId,
} from '../sim/types';

export interface ActorView {
  id: EntityId;
  templateId: ContentId;
  archetype: string;
  name: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  dead: boolean;
  downed: boolean;
  health: number;
  maxHealth: number;
  sneaking: boolean;
  blocking: boolean;
  attacking: boolean;
  attackKind: string | null;
  /** Remaining telegraph ticks when winding up a telegraphed ability. */
  telegraphTicks: number;
  isPlayer: boolean;
  /** True for player characters other than the viewing player. */
  isRemotePlayer: boolean;
  hostileToPlayer: boolean;
  hasDialogue: boolean;
  tier: string;
}

export interface ProjectileView {
  id: number;
  x: number;
  y: number;
  z: number;
  kind: 'arrow' | 'spell';
  channel: string;
}

export interface GroundAoeView {
  id: number;
  x: number;
  z: number;
  radius: number;
}

export interface PartyMemberView {
  charId: string;
  name: string;
  health: number;
  maxHealth: number;
  downed: boolean;
  spaceId: SpaceId;
  isSelf: boolean;
}

export interface WorldReadFacet {
  seed(): number;
  /** Space the viewing player currently occupies. */
  currentSpace(): SpaceId;
  spaceKind(spaceId: SpaceId): 'exterior' | 'interior';
  gameHours(): number;
  /** Actors in the viewing player's space (renderer culls further). */
  actorsInSpace(): ActorView[];
  projectilesInSpace(): ProjectileView[];
  groundAoesInSpace(): GroundAoeView[];
  player(): ActorView;
  party(): PartyMemberView[];
  playerResources(): {
    health: number;
    maxHealth: number;
    stamina: number;
    maxStamina: number;
    magicka: number;
    maxMagicka: number;
    level: number;
    xp: number;
    xpForNext: number;
    perkPoints: number;
    gold: number;
  };
  playerSkills(): { id: SkillId; level: number; xp: number; xpForNext: number }[];
  playerInventory(): { itemId: ContentId; name: string; count: number; equipped: boolean; kind: string; value: number }[];
  knownSpells(): { id: ContentId; name: string; cost: number }[];
  /** Events from the most recent tick, already filtered to what this player
   * should see (own progression, local combat, world messages). */
  drainEvents(): SimEvent[];
  nearestInteractablePrompt(): string | null;
  /** Sampling seam so the renderer never recomputes terrain differently. */
  groundHeight(x: number, z: number): number;
  /** Viewing player is downed (awaiting revive or release). */
  playerDowned(): boolean;
  /** Ticks until the downed player auto-releases. */
  downedTicksLeft(): number;
}
