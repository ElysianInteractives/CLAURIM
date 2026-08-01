// Shared simulation types and global tuning constants. Host-agnostic: no DOM,
// no Three.js, no wall clock. See docs/project/ARCHITECTURE.md.

// ---------------------------------------------------------------------------
// Tick
// ---------------------------------------------------------------------------

/** Simulation tick rate. LOCKED decision D-003: 30 Hz fixed step, renderer
 * interpolates. Do not change without a DECISIONS.md entry and re-tuning of
 * every duration constant. */
export const TICK_RATE = 30;
export const DT = 1 / TICK_RATE;

/** Game-hours advanced per real second of simulation (1 game day = 24 min). */
export const GAME_HOURS_PER_SECOND = 1 / 60;

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

/** Runtime entity id. Sequential, allocated deterministically at world init,
 * persisted in saves. 0 is reserved (no entity). */
export type EntityId = number;
export const NO_ENTITY: EntityId = 0;

/** Content id: a stable string key into a content table ("iron_sword"). */
export type ContentId = string;

/** Space id: an exterior region or an interior ("kaldwyn", "duskhollow_mine"). */
export type SpaceId = string;

/** Persistent character id (stable across connections; distinct from the
 * transient connection id owned by the server transport layer). */
export type CharacterId = string;

/** Party id. The first multiplayer milestone uses one deterministic default
 * party (see DECISIONS D-020); the model supports many. */
export type PartyId = string;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Position extends Vec3 {
  spaceId: SpaceId;
}

// ---------------------------------------------------------------------------
// Damage and stats
// ---------------------------------------------------------------------------

export type DamageChannel = 'physical' | 'fire' | 'frost' | 'shock' | 'poison';

export const DAMAGE_CHANNELS: readonly DamageChannel[] = [
  'physical',
  'fire',
  'frost',
  'shock',
  'poison',
];

/** Every stat the modifier system can target. Derived stats are recomputed
 * from base + modifiers each time modifiers change (see effects/modifiers.ts). */
export type StatKey =
  | 'maxHealth'
  | 'maxStamina'
  | 'maxMagicka'
  | 'healthRegen'
  | 'staminaRegen'
  | 'magickaRegen'
  | 'moveSpeed'
  | 'meleeDamage'
  | 'rangedDamage'
  | 'spellPower'
  | 'armor'
  | 'blockMitigation'
  | 'stealth'
  | 'detection'
  | 'carryWeight'
  | 'resistPhysical'
  | 'resistFire'
  | 'resistFrost'
  | 'resistShock'
  | 'resistPoison';

export type Stats = Record<StatKey, number>;

export const RESIST_BY_CHANNEL: Record<DamageChannel, StatKey> = {
  physical: 'resistPhysical',
  fire: 'resistFire',
  frost: 'resistFrost',
  shock: 'resistShock',
  poison: 'resistPoison',
};

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

export type SkillId =
  | 'oneHanded'
  | 'archery'
  | 'block'
  | 'lightArmor'
  | 'sneak'
  | 'destruction'
  | 'restoration'
  | 'smithing'
  | 'alchemy'
  | 'speech';

export const SKILL_IDS: readonly SkillId[] = [
  'oneHanded',
  'archery',
  'block',
  'lightArmor',
  'sneak',
  'destruction',
  'restoration',
  'smithing',
  'alchemy',
  'speech',
];

// ---------------------------------------------------------------------------
// Actors
// ---------------------------------------------------------------------------

export type ActorKind = 'player' | 'npc' | 'creature';

export type EquipSlot = 'mainHand' | 'offHand' | 'body' | 'head' | 'feet' | 'amulet';

export const EQUIP_SLOTS: readonly EquipSlot[] = [
  'mainHand',
  'offHand',
  'body',
  'head',
  'feet',
  'amulet',
];

export type AttackKind = 'melee' | 'ranged' | 'spell';
export type AttackPhase = 'windup' | 'active' | 'recover';

export interface QueuedAttack {
  kind: AttackKind;
  spellId?: ContentId;
}

export interface AttackState {
  kind: AttackKind;
  phase: AttackPhase;
  /** Ticks remaining in the current phase. */
  t: number;
  /** Spell content id when kind === 'spell'. */
  spellId?: ContentId;
  /** True once the melee hit for this swing has been resolved. */
  resolved?: boolean;
  power?: number;
  /** Set when this attack is a template ABILITY (boss/elite mechanics). */
  abilityId?: ContentId;
  /** Telegraphed windup: visible to players, may be interruptible. */
  telegraph?: boolean;
  interruptible?: boolean;
  /** Damage absorbed during an interruptible telegraph; crossing
   * INTERRUPT_DAMAGE cancels the cast. */
  interruptDamage?: number;
  /** One authoritative follow-up accepted during active/recovery. */
  queued?: QueuedAttack;
}

export type AiState = 'idle' | 'schedule' | 'combat' | 'search' | 'flee' | 'return' | 'dead';

export interface Brain {
  state: AiState;
  targetId: EntityId;
  lastKnownPos: Vec3 | null;
  /** Ticks remaining in current sub-behavior (search timer, attack pause...). */
  timer: number;
  homePos: Position;
  path: Vec3[] | null;
  pathIdx: number;
  /** Ticks until the next path recompute is allowed. */
  repathCooldown: number;
  /** Consecutive ticks without movement toward the current goal. Used only
   * to recover from a provably unreachable static route. */
  stuckTicks: number;
  alertness: number;
  /** Threat table: attacker entity id -> accumulated threat (D-017).
   * Transient (not serialized): combat state resets across saves. */
  threat: Record<number, number>;
  /** Party size the encounter was scaled for; locked at first aggro (D-018).
   * 0 = unscaled. */
  scaledFor: number;
  /** Per-ability cooldown ticks remaining, keyed by ability id. */
  abilityCooldowns: Record<string, number>;
  /** Current boss phase index (0-based) for templates with phases. */
  phase: number;
}

export interface ItemStack {
  itemId: ContentId;
  count: number;
}

export interface ActiveEffect {
  effectId: ContentId;
  /** Seconds remaining; Infinity for permanent (equipment/perk) effects. */
  remaining: number;
  stacks: number;
  /** Attribution: who or what applied it ("spell:flamebolt", "perk:juggernaut"). */
  source: string;
}

export interface SkillState {
  level: number;
  xp: number;
}

export interface Actor {
  id: EntityId;
  kind: ActorKind;
  /** Content id of the actor template (npc/creature) or 'player'. */
  templateId: ContentId;
  name: string;
  pos: Position;
  /** Facing yaw, radians. 0 = +z. */
  yaw: number;
  /** Player reticle elevation. Runtime intent only; not durable save state. */
  aimPitch: number;
  vel: Vec3;
  /** Current resources. */
  health: number;
  stamina: number;
  magicka: number;
  /** Derived stats, recomputed when modifiers change. */
  stats: Stats;
  dead: boolean;
  /** Sneaking stance (player) or innate stealth posture. */
  sneaking: boolean;
  blocking: boolean;
  sprinting: boolean;
  attack: AttackState | null;
  effects: ActiveEffect[];
  inventory: ItemStack[];
  equipment: Partial<Record<EquipSlot, ContentId>>;
  gold: number;
  skills: Record<SkillId, SkillState>;
  perks: ContentId[];
  level: number;
  characterXp: number;
  perkPoints: number;
  brain: Brain | null;
  factionId: ContentId | null;
  /** Player-only: incapacitated awaiting revive or release (D-021). */
  downed: boolean;
  /** Ticks until a downed player auto-releases. */
  downedTicks: number;
  /** Summoned adds despawn with their owner encounter. */
  summonedBy: EntityId;
  /** Spawner that owns this actor, for cleared-state persistence. */
  spawnerId: string | null;
  /** Loot rolled on death (from the template loot table). */
  lootRolled: boolean;
  /** Movement intent for this tick (set by hosts for the player, by AI for NPCs). */
  moveIntent: { x: number; z: number };
  interactCooldown: number;
}

// ---------------------------------------------------------------------------
// Projectiles
// ---------------------------------------------------------------------------

export interface Projectile {
  id: number;
  spaceId: SpaceId;
  pos: Vec3;
  vel: Vec3;
  channel: DamageChannel;
  damage: number;
  sourceId: EntityId;
  /** Seconds until despawn. */
  ttl: number;
  kind: 'arrow' | 'spell';
  spellId?: ContentId;
}

// ---------------------------------------------------------------------------
// Events (sim -> hosts, and sim-internal quest/journal feed)
// ---------------------------------------------------------------------------

export type SimEvent =
  | { type: 'damage'; targetId: EntityId; sourceId: EntityId; amount: number; channel: DamageChannel; blocked: boolean }
  | { type: 'actionRejected'; actorId: EntityId; action: AttackKind; reason: 'busy' | 'stamina' | 'weapon' | 'ammo' | 'magicka' | 'unknown' | 'incapacitated' }
  | { type: 'death'; targetId: EntityId; sourceId: EntityId; templateId: ContentId }
  | { type: 'heal'; targetId: EntityId; amount: number }
  | { type: 'itemAdded'; actorId: EntityId; itemId: ContentId; count: number }
  | { type: 'itemRemoved'; actorId: EntityId; itemId: ContentId; count: number }
  | { type: 'skillUp'; playerId: EntityId; skill: SkillId; level: number }
  | { type: 'levelUp'; playerId: EntityId; level: number }
  | { type: 'questStarted'; charId: CharacterId; questId: ContentId }
  | { type: 'questAdvanced'; charId: CharacterId; questId: ContentId; stageId: string }
  | { type: 'questCompleted'; charId: CharacterId; questId: ContentId }
  | { type: 'objectiveProgress'; charId: CharacterId; questId: ContentId; objectiveId: string; progress: number; required: number }
  | { type: 'dialogueLine'; speakerId: EntityId; text: string }
  | { type: 'spaceEntered'; playerId: EntityId; spaceId: SpaceId }
  | { type: 'interacted'; actorId: EntityId; targetKind: string; targetId: string }
  | { type: 'talkedTo'; playerId: EntityId; npcTemplateId: ContentId }
  | { type: 'effectApplied'; targetId: EntityId; effectId: ContentId }
  | { type: 'playerDowned'; playerId: EntityId }
  | { type: 'playerRevived'; playerId: EntityId; by: EntityId }
  | { type: 'playerReleased'; playerId: EntityId }
  | { type: 'playerRecovered'; playerId: EntityId }
  | {
      type: 'recoveryRejected';
      playerId: EntityId;
      reason: 'incapacitated' | 'combat' | 'cooldown';
      secondsRemaining: number;
    }
  | { type: 'encounterWipe'; bossId: EntityId }
  | { type: 'bossPhase'; bossId: EntityId; phase: number }
  | { type: 'telegraph'; sourceId: EntityId; abilityId: ContentId; ticks: number; interruptible: boolean }
  | { type: 'interrupted'; sourceId: EntityId; abilityId: ContentId }
  | { type: 'partyStatus'; charId: CharacterId; text: string }
  | { type: 'chat'; playerId: EntityId; text: string };

// ---------------------------------------------------------------------------
// Quests
// ---------------------------------------------------------------------------

export interface ObjectiveProgress {
  /** kill/collect counters keyed by objective id. */
  count: number;
  done: boolean;
}

export interface QuestState {
  questId: ContentId;
  /** Current stage id, or 'done' / 'failed'. */
  stageId: string;
  objectives: Record<string, ObjectiveProgress>;
  completed: boolean;
  failed: boolean;
}

// ---------------------------------------------------------------------------
// Combat tuning (LOCKED with D-007; change only with a DECISIONS.md entry)
// ---------------------------------------------------------------------------

export const MELEE_RANGE = 2.4;
export const MELEE_HEIGHT_TOLERANCE = 1.5;
export const MELEE_ARC_COS = Math.cos((100 * Math.PI) / 180 / 2);
export const BLOCK_ARC_COS = Math.cos((120 * Math.PI) / 180 / 2);
export const MELEE_WINDUP_TICKS = 8;
export const MELEE_ACTIVE_TICKS = 3;
export const MELEE_RECOVER_TICKS = 10;
export const RANGED_WINDUP_TICKS = 20;
export const SPELL_WINDUP_TICKS = 12;
export const ATTACK_STAMINA_COST = 12;
export const SPRINT_STAMINA_PER_SEC = 8;
export const BLOCK_STAMINA_ON_HIT = 8;
export const ARROW_SPEED = 38;
export const SPELL_PROJECTILE_SPEED = 24;
export const ARMOR_DR_FACTOR = 0.12;
export const ARMOR_DR_CAP = 0.8;
export const SNEAK_ATTACK_MULT = 2.5;
export const BASE_WALK_SPEED = 4.4;
export const SPRINT_MULT = 1.55;
export const SNEAK_MULT = 0.6;

// --- multiplayer combat (D-017/D-018/D-021) --------------------------------
/** Damage during an interruptible telegraph that cancels the cast. */
export const INTERRUPT_DAMAGE = 25;
/** Threat gained per point of damage dealt / healing done nearby. */
export const THREAT_PER_DAMAGE = 1;
export const THREAT_PER_HEAL = 0.8;
/** Per-second threat decay fraction. */
export const THREAT_DECAY_PER_SEC = 0.03;
/** A new target must exceed current target threat by this factor (hysteresis). */
export const THREAT_SWITCH_FACTOR = 1.25;
/** Encounter scaling per extra engaged player (health / damage). Damage
 * scales gently: big parties should feel pressure from ADDS and mechanics,
 * not from one-shot cleaves (measured via npm run mp:bench, 2026-07-31). */
export const SCALE_HP_PER_PLAYER = 0.4;
export const SCALE_DMG_PER_PLAYER = 0.08;
/** Radius for counting engaged players + party quest credit (meters). */
export const ENGAGE_RADIUS = 60;
/** Downed state duration before auto-release (ticks: 30 s). */
export const DOWNED_TICKS = 900;
export const REVIVE_HEALTH_FRAC = 0.3;
export const RELEASE_HEALTH_FRAC = 0.4;

/** Character XP required to advance from `level` to `level + 1`. */
export function xpForLevel(level: number): number {
  return 60 + 30 * (level - 1);
}

/** Skill XP required for the next skill level at `level`. */
export function skillXpForLevel(level: number): number {
  return 25 + level * 12;
}
