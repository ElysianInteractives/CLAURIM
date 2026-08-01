// Read facet: everything the renderer/UI may observe. Pure data out.

import type {
  ContentId,
  EntityId,
  EquipSlot,
  SimEvent,
  SkillId,
  SpaceId,
  SpellEquipSlot,
} from '../sim/types';
import type { MagicSchoolId } from '../sim/content/schema';

export interface InventoryItemView {
  itemId: ContentId;
  name: string;
  count: number;
  equipped: boolean;
  kind: string;
  value: number;
}

export interface EquipmentSlotView {
  slot: EquipSlot;
  label: string;
  itemId: ContentId | null;
  name: string | null;
  kind: string | null;
}

export interface KnownSpellView {
  id: ContentId;
  name: string;
  cost: number;
  school: MagicSchoolId;
  schoolName: string;
}

export interface EquippedSpellView {
  slot: SpellEquipSlot;
  hotkey: '1' | '2';
  spellId: ContentId | null;
  name: string | null;
  cost: number | null;
}

export interface ActorView {
  id: EntityId;
  templateId: ContentId;
  archetype: string;
  name: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  /** Vertical center-reticle angle in radians. */
  aimPitch: number;
  dead: boolean;
  downed: boolean;
  health: number;
  maxHealth: number;
  sneaking: boolean;
  blocking: boolean;
  attacking: boolean;
  attackKind: string | null;
  attackPhase: 'windup' | 'active' | 'recover' | null;
  /** Remaining telegraph ticks when winding up a telegraphed ability. */
  telegraphTicks: number;
  /** Authoritative equipped item ids used by world and first-person presentation. */
  equipment: Partial<Record<EquipSlot, ContentId>>;
  /** Authoritative danger shape for a currently winding-up ability. */
  telegraph?: {
    kind: 'frontal_cone' | 'ground_aoe' | 'summon' | 'heal_ally';
    ticks: number;
    totalTicks: number;
    interruptible: boolean;
    range: number;
    angleDegrees: number;
    radius: number;
    x: number;
    z: number;
  };
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
  entityId: EntityId | null;
  name: string;
  health: number;
  maxHealth: number;
  downed: boolean;
  spaceId: SpaceId;
  isSelf: boolean;
  online: boolean;
}

export interface PartyInviteView {
  fromCharId: string;
  fromName: string;
  fromEntityId: EntityId;
}

export interface WorldReadFacet {
  seed(): number;
  /** Space the viewing player currently occupies. */
  currentSpace(): SpaceId;
  /** Display name for an authored space. */
  spaceName(spaceId: SpaceId): string;
  spaceKind(spaceId: SpaceId): 'exterior' | 'interior';
  gameHours(): number;
  /** Actors in the viewing player's space (renderer culls further). */
  actorsInSpace(): ActorView[];
  projectilesInSpace(): ProjectileView[];
  groundAoesInSpace(): GroundAoeView[];
  player(): ActorView;
  partyId(): string | null;
  party(): PartyMemberView[];
  partyInvites(): PartyInviteView[];
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
  playerInventory(): InventoryItemView[];
  playerEquipment(): EquipmentSlotView[];
  knownSpells(): KnownSpellView[];
  equippedSpells(): EquippedSpellView[];
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
