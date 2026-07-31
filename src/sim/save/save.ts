// Save architecture (LOCKED D-009). A save is a versioned JSON envelope:
// full player state, per-actor world deltas, quest states, rng state, and the
// spawner/container/cleared bookkeeping. Loading validates the envelope,
// runs migrations oldVersion -> current in order, and rejects (never
// half-loads) anything it cannot migrate.
//
// Golden fixtures + round-trip + migration tests: tests/save.test.ts.

import type {
  Actor,
  CharacterId,
  ContentId,
  EntityId,
  PartyId,
  QuestState,
} from '../types';

/** v2: multiplayer world saves (D-013). v1 single-player saves migrate:
 * the sole player becomes character 'p1' in the default party. */
export const SAVE_SCHEMA_VERSION = 2;

export interface ActorSave {
  id: EntityId;
  templateId: ContentId;
  kind: Actor['kind'];
  name: string;
  pos: { spaceId: string; x: number; y: number; z: number };
  yaw: number;
  health: number;
  stamina: number;
  magicka: number;
  dead: boolean;
  inventory: { itemId: string; count: number }[];
  equipment: Record<string, string>;
  gold: number;
  effects: { effectId: string; remaining: number; stacks: number; source: string }[];
  spawnerId: string | null;
  lootRolled: boolean;
  downed?: boolean;
  downedTicks?: number;
  brainState?: {
    state: string;
    homePos: { spaceId: string; x: number; y: number; z: number };
  };
  // Player-only fields.
  skills?: Record<string, { level: number; xp: number }>;
  perks?: string[];
  level?: number;
  characterXp?: number;
  perkPoints?: number;
}

export interface SaveGame {
  schemaVersion: number;
  contentVersion: string;
  seed: number;
  tick: number;
  rngState: number;
  nextEntityId: number;
  /** Characters resident in this world save. */
  players: { charId: CharacterId; entityId: EntityId }[];
  primaryCharId: CharacterId | null;
  actors: ActorSave[];
  /** Per-character quest journals (D-020). */
  questLogs: { charId: CharacterId; quests: QuestState[] }[];
  /** Per-character known spells. */
  knownSpells: { charId: CharacterId; spells: ContentId[] }[];
  /** Per-character looted-container sets (D-019 personal container loot). */
  containersLootedBy: { charId: CharacterId; ids: string[] }[];
  parties: { partyId: PartyId; members: CharacterId[] }[];
  /** Spawner ids that have already produced their actors. */
  spawnersSpawned: string[];
}

export type MigrationFn = (raw: Record<string, unknown>) => Record<string, unknown>;

/** Migration registry: MIGRATIONS[v] upgrades a save FROM schema v TO v+1.
 * Every entry must be pure and total for well-formed input of its version. */
export const MIGRATIONS: Record<number, MigrationFn> = {
  // v0 -> v1 exemplar: v0 saves (pre-release) lacked containersLooted and
  // spawnersSpawned; default them empty. Kept as the migration-path template.
  0: (raw) => {
    return {
      ...raw,
      schemaVersion: 1,
      containersLooted: raw.containersLooted ?? [],
      spawnersSpawned: raw.spawnersSpawned ?? [],
    };
  },
  // v1 -> v2: single-player -> multiplayer world save (D-013). The sole
  // player becomes character 'p1'; its journal, known spells, and looted
  // containers become per-character records; a default party is created.
  1: (raw) => {
    const playerId = raw.playerId as number;
    const quests = (raw.quests as unknown[]) ?? [];
    const looted = (raw.containersLooted as string[]) ?? [];
    const spells = (raw.playerKnownSpells as string[]) ?? ['flamebolt', 'mend_wounds'];
    const out: Record<string, unknown> = {
      ...raw,
      schemaVersion: 2,
      players: [{ charId: 'p1', entityId: playerId }],
      primaryCharId: 'p1',
      questLogs: [{ charId: 'p1', quests }],
      knownSpells: [{ charId: 'p1', spells }],
      containersLootedBy: [{ charId: 'p1', ids: looted }],
      parties: [{ partyId: 'fellowship', members: ['p1'] }],
    };
    delete out.playerId;
    delete out.quests;
    delete out.containersLooted;
    delete out.playerKnownSpells;
    return out;
  },
};

export class SaveError extends Error {}

/** Parse + migrate + structurally validate a save payload. Throws SaveError
 * on anything unusable; never returns a partially valid save. */
export function parseSave(json: string): SaveGame {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(json) as Record<string, unknown>;
  } catch {
    throw new SaveError('corrupt save: not valid JSON');
  }
  if (typeof raw !== 'object' || raw === null) throw new SaveError('corrupt save: not an object');
  let version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 0;
  if (version > SAVE_SCHEMA_VERSION) {
    throw new SaveError(`save schema ${version} is newer than supported ${SAVE_SCHEMA_VERSION}`);
  }
  while (version < SAVE_SCHEMA_VERSION) {
    const migrate = MIGRATIONS[version];
    if (!migrate) throw new SaveError(`no migration path from schema ${version}`);
    raw = migrate(raw);
    const newVersion = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : version;
    if (newVersion <= version) throw new SaveError(`migration from ${version} did not advance`);
    version = newVersion;
  }
  // Structural validation of the current shape.
  const required: [string, string][] = [
    ['seed', 'number'],
    ['tick', 'number'],
    ['rngState', 'number'],
    ['nextEntityId', 'number'],
    ['contentVersion', 'string'],
  ];
  for (const [key, type] of required) {
    if (typeof raw[key] !== type) throw new SaveError(`corrupt save: bad ${key}`);
  }
  for (const key of ['actors', 'players', 'questLogs', 'knownSpells', 'containersLootedBy', 'parties', 'spawnersSpawned']) {
    if (!Array.isArray(raw[key])) throw new SaveError(`corrupt save: bad ${key}`);
  }
  const save = raw as unknown as SaveGame;
  for (const p of save.players) {
    if (typeof p.charId !== 'string' || typeof p.entityId !== 'number') {
      throw new SaveError('corrupt save: bad player record');
    }
    if (!save.actors.some((a) => a.id === p.entityId)) {
      throw new SaveError(`corrupt save: actor missing for character ${p.charId}`);
    }
  }
  return save;
}

// ---------------------------------------------------------------------------
// Per-character persistence (server-owned; D-016). A CharacterSave is the
// durable record for one character independent of any world save, restored
// on (re)connect. Versioned separately from the world schema.
// ---------------------------------------------------------------------------

export const CHARACTER_SCHEMA_VERSION = 1;

export interface CharacterSave {
  schemaVersion: number;
  contentVersion: string;
  charId: CharacterId;
  name: string;
  pos: { spaceId: string; x: number; y: number; z: number };
  yaw: number;
  health: number;
  stamina: number;
  magicka: number;
  inventory: { itemId: string; count: number }[];
  equipment: Record<string, string>;
  gold: number;
  effects: { effectId: string; remaining: number; stacks: number; source: string }[];
  skills: Record<string, { level: number; xp: number }>;
  perks: string[];
  level: number;
  characterXp: number;
  perkPoints: number;
  knownSpells: ContentId[];
  quests: QuestState[];
  containersLooted: string[];
}

export const CHARACTER_MIGRATIONS: Record<number, MigrationFn> = {};

export function parseCharacterSave(json: string): CharacterSave {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(json) as Record<string, unknown>;
  } catch {
    throw new SaveError('corrupt character save: not valid JSON');
  }
  let version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 0;
  if (version > CHARACTER_SCHEMA_VERSION) {
    throw new SaveError(`character schema ${version} newer than supported ${CHARACTER_SCHEMA_VERSION}`);
  }
  while (version < CHARACTER_SCHEMA_VERSION) {
    const migrate = CHARACTER_MIGRATIONS[version];
    if (!migrate) throw new SaveError(`no character migration path from ${version}`);
    raw = migrate(raw);
    const v = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : version;
    if (v <= version) throw new SaveError('character migration did not advance');
    version = v;
  }
  if (typeof raw.charId !== 'string' || typeof raw.name !== 'string') {
    throw new SaveError('corrupt character save: bad identity');
  }
  if (typeof raw.pos !== 'object' || raw.pos === null) throw new SaveError('corrupt character save: bad pos');
  for (const key of ['inventory', 'perks', 'quests', 'containersLooted', 'knownSpells']) {
    if (!Array.isArray(raw[key])) throw new SaveError(`corrupt character save: bad ${key}`);
  }
  return raw as unknown as CharacterSave;
}
