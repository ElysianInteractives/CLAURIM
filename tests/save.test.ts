// Save architecture: round-trips, migration path, corruption rejection,
// and persistence of world deltas (cleared spawners, looted containers).

import { describe, expect, it } from 'vitest';
import { Sim, type PlayerInput } from '../src/sim/sim';
import { parseSave, SaveError, SAVE_SCHEMA_VERSION } from '../src/sim/save/save';

const idle: PlayerInput = { moveX: 0, moveZ: 0, yaw: 0, sprint: false, sneak: false, block: false, jump: false };

describe('save round-trip', () => {
  it('serialize -> load -> serialize is byte-identical', () => {
    const sim = new Sim(99);
    for (let t = 0; t < 120; t++) sim.tick(idle);
    const first = sim.saveToJson();
    const loaded = Sim.load(first);
    expect(loaded.saveToJson()).toEqual(first);
  });

  it('player state survives: inventory, equipment, skills, quests, gold', () => {
    const sim = new Sim(7);
    sim.playerStartQuest('hollow_delve');
    sim.player().gold = 999;
    sim.context().trainSkill(sim.playerIdValue, 'oneHanded', 500);
    const loaded = Sim.load(sim.saveToJson());
    expect(loaded.player().gold).toBe(999);
    expect(loaded.quests.get('hollow_delve')?.stageId).toBe('entrance');
    expect(loaded.player().skills.oneHanded.level).toBeGreaterThan(1);
    expect(loaded.player().equipment.mainHand).toBe('worn_dagger');
  });

  it('world deltas survive: dead actors stay dead, looted containers stay looted', () => {
    const sim = new Sim(7);
    // Kill a specific raider and loot a container by force.
    const raider = [...sim.actors.values()].find((a) => a.templateId === 'redclaw_raider')!;
    sim.context().dealDamage(raider.id, sim.playerIdValue, 10000, 'physical');
    expect(raider.dead).toBe(true);
    sim.containersLooted.add('ruin_chest');
    const loaded = Sim.load(sim.saveToJson());
    expect(loaded.actors.get(raider.id)?.dead).toBe(true);
    expect(loaded.containersLooted.has('ruin_chest')).toBe(true);
  });
});

describe('migrations', () => {
  it('a v0 save (no spawner/container bookkeeping) migrates to current', () => {
    const sim = new Sim(3);
    const raw = JSON.parse(sim.saveToJson());
    delete raw.schemaVersion;
    delete raw.spawnersSpawned;
    delete raw.containersLooted;
    const migrated = parseSave(JSON.stringify(raw));
    expect(migrated.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(migrated.spawnersSpawned).toEqual([]);
    expect(migrated.containersLooted).toEqual([]);
    // And it actually loads.
    const loaded = Sim.load(JSON.stringify(raw));
    expect(loaded.player().name).toBe('Wanderer');
  });

  it('rejects newer-than-supported schema', () => {
    const sim = new Sim(3);
    const raw = JSON.parse(sim.saveToJson());
    raw.schemaVersion = SAVE_SCHEMA_VERSION + 10;
    expect(() => parseSave(JSON.stringify(raw))).toThrow(SaveError);
  });

  it('rejects corrupt payloads without partial loads', () => {
    expect(() => parseSave('not json at all')).toThrow(SaveError);
    expect(() => parseSave('{}')).toThrow(SaveError);
    const sim = new Sim(3);
    const raw = JSON.parse(sim.saveToJson());
    raw.actors = raw.actors.filter((a: { id: number }) => a.id !== raw.playerId);
    expect(() => parseSave(JSON.stringify(raw))).toThrow(SaveError);
  });

  it('drops actors whose template no longer exists instead of crashing', () => {
    const sim = new Sim(3);
    const raw = JSON.parse(sim.saveToJson());
    const wolf = raw.actors.find((a: { templateId: string }) => a.templateId === 'frostfang_wolf');
    wolf.templateId = 'deleted_creature_from_old_content';
    const loaded = Sim.load(JSON.stringify(raw));
    expect(loaded.actors.get(wolf.id)).toBeUndefined();
    expect(loaded.player().name).toBe('Wanderer');
  });
});
