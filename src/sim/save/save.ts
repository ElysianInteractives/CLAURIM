// Save architecture (LOCKED D-009). A save is a versioned JSON envelope:
// full player state, per-actor world deltas, quest states, rng state, and the
// spawner/container/cleared bookkeeping. Loading validates the envelope,
// runs migrations oldVersion -> current in order, and rejects (never
// half-loads) anything it cannot migrate.
//
// Golden fixtures + round-trip + migration tests: tests/save.test.ts.

import type {
  Actor,
  ContentId,
  EntityId,
  QuestState,
} from '../types';

export const SAVE_SCHEMA_VERSION = 1;

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
  playerId: EntityId;
  actors: ActorSave[];
  quests: QuestState[];
  /** Spawner ids that have already produced their actors. */
  spawnersSpawned: string[];
  /** Container ids already looted (their loot is rolled exactly once). */
  containersLooted: string[];
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
    ['playerId', 'number'],
    ['contentVersion', 'string'],
  ];
  for (const [key, type] of required) {
    if (typeof raw[key] !== type) throw new SaveError(`corrupt save: bad ${key}`);
  }
  if (!Array.isArray(raw.actors)) throw new SaveError('corrupt save: bad actors');
  if (!Array.isArray(raw.quests)) throw new SaveError('corrupt save: bad quests');
  if (!Array.isArray(raw.spawnersSpawned)) throw new SaveError('corrupt save: bad spawnersSpawned');
  if (!Array.isArray(raw.containersLooted)) throw new SaveError('corrupt save: bad containersLooted');
  const save = raw as unknown as SaveGame;
  if (!save.actors.some((a) => a.id === save.playerId)) {
    throw new SaveError('corrupt save: player actor missing');
  }
  return save;
}
