// Save architecture: round-trips, the FULL migration chain (v0 -> v1 -> v2 -> v3 -> v4),
// corruption rejection, and persistence of world deltas. The invariants these
// protect predate multiplayer and must stay: byte-identical round-trips,
// reject-never-half-load, and a working migration path for every old schema.

import { describe, expect, it } from 'vitest';
import { Sim, type PlayerInput } from '../src/sim/sim';
import { parseCharacterSave, parseSave, SaveError, SAVE_SCHEMA_VERSION } from '../src/sim/save/save';

const idle: PlayerInput = { moveX: 0, moveZ: 0, yaw: 0, pitch: 0, sprint: false, sneak: false, block: false, jump: false };

/** Build a faithful v1-era (single-player) save payload from a live sim. */
function makeV1Save(sim: Sim): Record<string, unknown> {
  const v2 = sim.serialize() as unknown as Record<string, unknown>;
  const players = v2.players as { charId: string; entityId: number }[];
  const questLogs = v2.questLogs as { charId: string; quests: unknown[] }[];
  const looted = v2.containersLootedBy as { charId: string; ids: string[] }[];
  const spells = v2.knownSpells as { charId: string; spells: string[] }[];
  const v1: Record<string, unknown> = {
    ...v2,
    schemaVersion: 1,
    playerId: players[0].entityId,
    quests: questLogs.find((q) => q.charId === players[0].charId)?.quests ?? [],
    containersLooted: looted.find((c) => c.charId === players[0].charId)?.ids ?? [],
    playerKnownSpells: spells.find((s) => s.charId === players[0].charId)?.spells ?? [],
  };
  delete v1.players;
  delete v1.primaryCharId;
  delete v1.questLogs;
  delete v1.knownSpells;
  delete v1.equippedSpells;
  delete v1.containersLootedBy;
  delete v1.characterNames;
  delete v1.parties;
  return v1;
}

describe('save round-trip (v4)', () => {
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
    sim.context().trainSkill(sim.player().id, 'oneHanded', 500);
    const loaded = Sim.load(sim.saveToJson());
    expect(loaded.player().gold).toBe(999);
    expect(loaded.questLogOf('p1').get('hollow_delve')?.stageId).toBe('entrance');
    expect(loaded.player().skills.oneHanded.level).toBeGreaterThan(1);
    expect(loaded.player().equipment.mainHand).toBe('worn_dagger');
    expect(loaded.spellLoadoutFor('p1')).toEqual({ spell1: 'flamebolt', spell2: 'mend_wounds' });
  });

  it('multiplayer state survives: two characters, parties, per-char journals', () => {
    const sim = new Sim(7);
    sim.addPlayer('p2', 'Second');
    sim.joinParty('p1', 'party:p1');
    sim.joinParty('p2', 'party:p1');
    sim.startQuestFor('p2', 'hollow_delve');
    const loaded = Sim.load(sim.saveToJson());
    expect(loaded.players.size).toBe(2);
    expect(loaded.questLogOf('p2').has('hollow_delve')).toBe(true);
    expect(loaded.questLogOf('p1').has('hollow_delve')).toBe(false);
    expect(loaded.partyMembersOf('p1').sort()).toEqual(['p1', 'p2']);
  });

  it('world deltas survive: dead actors stay dead, looted containers stay looted per character', () => {
    const sim = new Sim(7);
    const raider = [...sim.actors.values()].find((a) => a.templateId === 'redclaw_raider')!;
    sim.context().dealDamage(raider.id, sim.player().id, 10000, 'physical');
    expect(raider.dead).toBe(true);
    sim.containersLootedOf('p1').add('ruin_chest');
    const loaded = Sim.load(sim.saveToJson());
    expect(loaded.actors.get(raider.id)?.dead).toBe(true);
    expect(loaded.containersLootedOf('p1').has('ruin_chest')).toBe(true);
  });
});

describe('migrations', () => {
  it('a v1 single-player save migrates through multiplayer into the explicit-party shape', () => {
    const sim = new Sim(3);
    sim.playerStartQuest('hollow_delve');
    sim.containersLootedOf('p1').add('ruin_chest');
    const v1 = makeV1Save(sim);
    const migrated = parseSave(JSON.stringify(v1));
    expect(migrated.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(migrated.players).toEqual([{ charId: 'p1', entityId: sim.player().id }]);
    expect(migrated.parties).toEqual([]);
    expect(migrated.equippedSpells).toEqual([{
      charId: 'p1',
      slots: { spell1: 'flamebolt', spell2: 'mend_wounds' },
    }]);
    const loaded = Sim.load(JSON.stringify(v1));
    expect(loaded.player().name).toBe('Wanderer');
    expect(loaded.questLogOf('p1').get('hollow_delve')?.stageId).toBe('entrance');
    expect(loaded.containersLootedOf('p1').has('ruin_chest')).toBe(true);
  });

  it('removes the legacy global fellowship when a v2 world first upgrades', () => {
    const sim = new Sim(3);
    const raw = sim.serialize() as unknown as Record<string, unknown>;
    raw.schemaVersion = 2;
    raw.parties = [{ partyId: 'fellowship', members: ['p1', 'p2'] }];
    expect(parseSave(JSON.stringify(raw)).parties).toEqual([]);
  });

  it('migrates a v3 world and v1 character to explicit spell loadouts', () => {
    const sim = new Sim(13);
    const world = sim.serialize() as unknown as Record<string, unknown>;
    world.schemaVersion = 3;
    delete world.equippedSpells;
    expect(parseSave(JSON.stringify(world)).equippedSpells).toEqual([{
      charId: 'p1',
      slots: { spell1: 'flamebolt', spell2: 'mend_wounds' },
    }]);

    const character = sim.extractCharacter('p1') as unknown as Record<string, unknown>;
    character.schemaVersion = 1;
    delete character.equippedSpells;
    expect(parseCharacterSave(JSON.stringify(character)).equippedSpells).toEqual({
      spell1: 'flamebolt',
      spell2: 'mend_wounds',
    });
  });

  it('a v0 save (no bookkeeping at all) migrates through the whole chain', () => {
    const sim = new Sim(3);
    const v1 = makeV1Save(sim);
    delete v1.schemaVersion;
    delete v1.spawnersSpawned;
    delete v1.containersLooted;
    const migrated = parseSave(JSON.stringify(v1));
    expect(migrated.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(migrated.spawnersSpawned).toEqual([]);
    const loaded = Sim.load(JSON.stringify(v1));
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
    raw.actors = raw.actors.filter((a: { id: number }) => a.id !== sim.player().id);
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
