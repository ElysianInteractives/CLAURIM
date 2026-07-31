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
  health: number;
  maxHealth: number;
  sneaking: boolean;
  blocking: boolean;
  attacking: boolean;
  attackKind: string | null;
  isPlayer: boolean;
  hostileToPlayer: boolean;
  hasDialogue: boolean;
}

export interface ProjectileView {
  id: number;
  x: number;
  y: number;
  z: number;
  kind: 'arrow' | 'spell';
  channel: string;
}

export interface WorldReadFacet {
  seed(): number;
  /** Space the player currently occupies. */
  currentSpace(): SpaceId;
  spaceKind(spaceId: SpaceId): 'exterior' | 'interior';
  gameHours(): number;
  /** Actors in the player's space (renderer culls further). */
  actorsInSpace(): ActorView[];
  projectilesInSpace(): ProjectileView[];
  player(): ActorView;
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
  /** Events from the most recent tick (damage numbers, notifications). */
  drainEvents(): SimEvent[];
  nearestInteractablePrompt(): string | null;
  /** Sampling seam so the renderer never recomputes terrain differently. */
  groundHeight(x: number, z: number): number;
  playerDead(): boolean;
}
