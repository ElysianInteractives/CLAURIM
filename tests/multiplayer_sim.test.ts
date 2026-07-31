// Multiplayer sim model (D-013/D-017/D-018/D-019/D-020/D-021): many player
// characters in ONE authoritative Sim, per-character state, party credit,
// threat, downed/revive, boss phases, interrupts, scaling locks, wipes,
// and personal loot.

import { describe, expect, it } from 'vitest';
import { Sim, IDLE_INPUT, type PlayerInput } from '../src/sim/sim';
import { beginDialogue } from '../src/sim/dialogue/dialogue_runtime';
import { INTERRUPT_DAMAGE } from '../src/sim/types';

const idle: PlayerInput = { ...IDLE_INPUT };

function twoPlayerSim(seed = 42): Sim {
  const sim = new Sim(seed);
  sim.addPlayer('p2', 'Brona');
  return sim;
}

/** Teleport a character (test-only positioning). */
function put(sim: Sim, charId: string, spaceId: string, x: number, z: number): void {
  sim.movePlayerTo(charId, spaceId, x, z, 0);
}

describe('per-character state', () => {
  it('two players have separate inventories, gold, progression, and journals', () => {
    const sim = twoPlayerSim();
    const p1 = sim.playerActor('p1')!;
    const p2 = sim.playerActor('p2')!;
    expect(p1.id).not.toBe(p2.id);
    sim.context().addItem(p1.id, 'iron_sword', 1);
    expect(sim.context().countItem(p1.id, 'iron_sword')).toBe(1);
    expect(sim.context().countItem(p2.id, 'iron_sword')).toBe(0);
    sim.context().trainSkill(p1.id, 'oneHanded', 300);
    expect(p1.skills.oneHanded.level).toBeGreaterThan(1);
    expect(p2.skills.oneHanded.level).toBe(1);
    sim.startQuestFor('p1', 'hollow_delve');
    expect(sim.questLogOf('p1').has('hollow_delve')).toBe(true);
    expect(sim.questLogOf('p2').has('hollow_delve')).toBe(false);
  });

  it('dialogue and shop sessions are per character (no cross-open)', () => {
    const sim = twoPlayerSim();
    const maera = [...sim.actors.values()].find((a) => a.templateId === 'maera')!;
    const session = beginDialogue(sim.context(), 'p1', maera.id);
    expect(session).toBeTruthy();
    sim.dialogueSessions.set('p1', session!);
    expect(sim.dialogueNodeFor('p1')).toBeTruthy();
    expect(sim.dialogueNodeFor('p2')).toBeNull();
    // Both may hold parallel sessions with the same NPC.
    const session2 = beginDialogue(sim.context(), 'p2', maera.id);
    expect(session2).toBeTruthy();
    expect(session2!.charId).toBe('p2');
  });

  it('container loot is personal: each character opens their own', () => {
    const sim = twoPlayerSim();
    put(sim, 'p1', 'kaldwyn', 44, -424); // ruin_chest
    put(sim, 'p2', 'kaldwyn', 44, -424);
    expect(sim.interactFor('p1')).toBe('container');
    expect(sim.containersLootedOf('p1').has('ruin_chest')).toBe(true);
    expect(sim.containersLootedOf('p2').has('ruin_chest')).toBe(false);
    expect(sim.interactFor('p2')).toBe('container');
    expect(sim.containersLootedOf('p2').has('ruin_chest')).toBe(true);
  });
});

describe('party quest credit (D-020)', () => {
  it('kill credit is shared with nearby party members, personal collect is not', () => {
    const sim = twoPlayerSim();
    sim.startQuestFor('p1', 'hollow_delve');
    sim.startQuestFor('p2', 'hollow_delve');
    // Both stand at the mine gate; p1 lands the kills.
    put(sim, 'p1', 'kaldwyn', 110, 330);
    put(sim, 'p2', 'kaldwyn', 112, 330);
    for (const a of [...sim.actors.values()]) {
      if (a.templateId === 'redclaw_raider' && a.spawnerId === 'sp_gate_raiders') {
        sim.context().dealDamage(a.id, sim.playerActor('p1')!.id, 100000, 'physical');
      }
    }
    const q1 = sim.questLogOf('p1').get('hollow_delve')!;
    const q2 = sim.questLogOf('p2').get('hollow_delve')!;
    expect(q1.objectives.clear_gate.done).toBe(true);
    expect(q2.objectives.clear_gate.done).toBe(true);
  });

  it('kill credit does NOT reach party members far away', () => {
    const sim = twoPlayerSim();
    sim.startQuestFor('p1', 'hollow_delve');
    sim.startQuestFor('p2', 'hollow_delve');
    put(sim, 'p1', 'kaldwyn', 110, 330);
    put(sim, 'p2', 'kaldwyn', -300, -300); // far across the region
    for (const a of [...sim.actors.values()]) {
      if (a.templateId === 'redclaw_raider' && a.spawnerId === 'sp_gate_raiders') {
        sim.context().dealDamage(a.id, sim.playerActor('p1')!.id, 100000, 'physical');
      }
    }
    expect(sim.questLogOf('p1').get('hollow_delve')!.objectives.clear_gate.done).toBe(true);
    expect(sim.questLogOf('p2').get('hollow_delve')!.objectives.clear_gate.done).toBe(false);
  });
});

describe('downed / revive / release (D-021)', () => {
  it('a player at 0 health goes downed, not dead; a party member revives them', () => {
    const sim = twoPlayerSim();
    put(sim, 'p1', 'kaldwyn', 40, -416);
    put(sim, 'p2', 'kaldwyn', 41, -416);
    const p1 = sim.playerActor('p1')!;
    sim.context().dealDamage(p1.id, 0, 100000, 'physical');
    expect(p1.downed).toBe(true);
    expect(p1.dead).toBe(false);
    // Downed players take no further damage and cannot act.
    sim.context().dealDamage(p1.id, 0, 50, 'physical');
    expect(p1.downed).toBe(true);
    expect(sim.meleeFor('p1')).toBe(false);
    // p2 revives via interact.
    expect(sim.nearestInteractableFor('p2')?.kind).toBe('revive');
    expect(sim.interactFor('p2')).toBe('revive');
    expect(p1.downed).toBe(false);
    expect(p1.health).toBeGreaterThan(0);
  });

  it('an unrevived player auto-releases to the recovery point', () => {
    const sim = twoPlayerSim();
    put(sim, 'p2', 'kaldwyn', -300, -300); // out of revive range
    const p1 = sim.playerActor('p1')!;
    sim.context().dealDamage(p1.id, 0, 100000, 'physical');
    expect(p1.downed).toBe(true);
    for (let t = 0; t < 901 && p1.downed; t++) sim.tick(new Map());
    expect(p1.downed).toBe(false);
    expect(p1.health).toBeGreaterThan(0);
  });
});

describe('boss encounter (D-017/D-018)', () => {
  function bossFight(partySize: 1 | 2): { sim: Sim; bossId: number } {
    const sim = new Sim(42);
    if (partySize >= 2) sim.addPlayer('p2', 'Brona');
    const boss = [...sim.actors.values()].find((a) => a.templateId === 'barrow_wight')!;
    // In FRONT of the boss (it spawns facing +z), inside its vision cone.
    put(sim, 'p1', 'duskhollow_mine', 1.5, 64);
    if (partySize >= 2) put(sim, 'p2', 'duskhollow_mine', -1.5, 64);
    return { sim, bossId: boss.id };
  }

  it('encounter scaling locks to engaged party size and resets on wipe', () => {
    const solo = bossFight(1);
    const soloBoss = solo.sim.actors.get(solo.bossId)!;
    for (let t = 0; t < 30 && soloBoss.brain!.state !== 'combat'; t++) solo.sim.tick(idle);
    expect(soloBoss.brain!.state).toBe('combat');
    expect(soloBoss.brain!.scaledFor).toBe(1);
    const soloHp = soloBoss.stats.maxHealth;

    const duo = bossFight(2);
    const duoBoss = duo.sim.actors.get(duo.bossId)!;
    for (let t = 0; t < 30 && duoBoss.brain!.state !== 'combat'; t++) duo.sim.tick(new Map());
    expect(duoBoss.brain!.scaledFor).toBe(2);
    expect(duoBoss.stats.maxHealth).toBeGreaterThan(soloHp * 1.5);

    // Wipe: both players downed -> encounter resets, scaling unlocks.
    for (const charId of ['p1', 'p2']) {
      const p = duo.sim.playerActor(charId)!;
      duo.sim.context().dealDamage(p.id, duo.bossId, 100000, 'frost');
    }
    for (let t = 0; t < 20; t++) duo.sim.tick(new Map());
    expect(duoBoss.brain!.state).not.toBe('combat');
    expect(duoBoss.brain!.scaledFor).toBe(0);
    expect(duoBoss.health).toBe(duoBoss.stats.maxHealth);
  });

  it('threat: the boss switches to a rival only past the hysteresis factor', () => {
    const { sim, bossId } = bossFight(2);
    const boss = sim.actors.get(bossId)!;
    const p1 = sim.playerActor('p1')!;
    const p2 = sim.playerActor('p2')!;
    for (let t = 0; t < 30 && boss.brain!.state !== 'combat'; t++) sim.tick(new Map());
    // Let any in-flight boss swing finish (tickBrain defers while attacking),
    // then pin threat values and observe selection across a few ticks.
    const settle = () => {
      for (let t = 0; t < 60; t++) {
        if (!boss.attack) break;
        sim.tick(new Map());
      }
    };
    settle();
    boss.brain!.threat[p1.id] = 100;
    boss.brain!.targetId = p1.id;
    // p2 out-threatens slightly: no switch (hysteresis 1.25x).
    boss.brain!.threat[p2.id] = 110;
    sim.tick(new Map());
    expect(boss.brain!.targetId).toBe(p1.id);
    // p2 far exceeds: switch (allow a few ticks in case a swing is mid-flight).
    settle();
    boss.brain!.threat[p1.id] = 100;
    boss.brain!.threat[p2.id] = 300;
    for (let t = 0; t < 60 && boss.brain!.targetId !== p2.id; t++) sim.tick(new Map());
    expect(boss.brain!.targetId).toBe(p2.id);
  });

  it('phases unlock the thrall summon; interruptible casts can be broken', () => {
    const { sim, bossId } = bossFight(2);
    const boss = sim.actors.get(bossId)!;
    for (let t = 0; t < 30 && boss.brain!.state !== 'combat'; t++) sim.tick(new Map());
    // Drop the boss to phase 1 territory.
    boss.health = boss.stats.maxHealth * 0.5;
    let sawPhase = false;
    let sawSummonOrTelegraph = false;
    for (let t = 0; t < 600; t++) {
      sim.tick(new Map());
      for (const e of sim.events) {
        if (e.type === 'bossPhase') sawPhase = true;
        if (e.type === 'telegraph') sawSummonOrTelegraph = true;
      }
      if (sawPhase && sawSummonOrTelegraph) break;
    }
    expect(sawPhase).toBe(true);
    expect(sawSummonOrTelegraph).toBe(true);

    // Interrupt: when an interruptible telegraph is up, burst damage cancels it.
    let interrupted = false;
    for (let t = 0; t < 1200 && !interrupted; t++) {
      sim.tick(new Map());
      if (boss.attack?.telegraph && boss.attack.interruptible) {
        sim.context().dealDamage(bossId, sim.playerActor('p1')!.id, INTERRUPT_DAMAGE + 20, 'physical');
        for (const e of sim.events) {
          if (e.type === 'interrupted') interrupted = true;
        }
        if (boss.attack === null) interrupted = true;
      }
    }
    expect(interrupted).toBe(true);
  });

  it('boss kill delivers PERSONAL loot to each nearby party member (D-019)', () => {
    const { sim, bossId } = bossFight(2);
    const p1 = sim.playerActor('p1')!;
    const p2 = sim.playerActor('p2')!;
    const count = (a: typeof p1, item: string) =>
      a.inventory.filter((s) => s.itemId === item).reduce((n, s) => n + s.count, 0);
    expect(count(p1, 'steel_sword')).toBe(0);
    sim.context().dealDamage(bossId, p1.id, 1000000, 'physical');
    expect(count(p1, 'steel_sword')).toBe(1);
    expect(count(p2, 'steel_sword')).toBe(1); // own roll, not shared corpse
    expect(count(p1, 'duskhollow_ore')).toBe(1);
    expect(count(p2, 'duskhollow_ore')).toBe(1);
  });

  it('multiple enemies target different players via their own threat tables', () => {
    const sim = twoPlayerSim();
    // Two wolves; each is provoked by a different player.
    const wolves = [...sim.actors.values()].filter((a) => a.templateId === 'frostfang_wolf');
    expect(wolves.length).toBeGreaterThanOrEqual(2);
    const p1 = sim.playerActor('p1')!;
    const p2 = sim.playerActor('p2')!;
    put(sim, 'p1', 'kaldwyn', wolves[0].pos.x + 1, wolves[0].pos.z);
    put(sim, 'p2', 'kaldwyn', wolves[1].pos.x + 1, wolves[1].pos.z);
    sim.context().dealDamage(wolves[0].id, p1.id, 5, 'physical');
    sim.context().dealDamage(wolves[1].id, p2.id, 5, 'physical');
    sim.tick(new Map());
    expect(wolves[0].brain!.targetId).toBe(p1.id);
    expect(wolves[1].brain!.targetId).toBe(p2.id);
  });
});

describe('multiplayer determinism', () => {
  it('same seed + same two-player input script => identical serialized state', () => {
    const script = (t: number): Map<string, PlayerInput> =>
      new Map([
        ['p1', { ...idle, moveZ: t % 40 < 20 ? 1 : 0, yaw: t * 0.01 }],
        ['p2', { ...idle, moveX: t % 60 < 30 ? 1 : -1, yaw: -t * 0.02, sprint: t % 90 < 30 }],
      ]);
    const a = twoPlayerSim(777);
    const b = twoPlayerSim(777);
    for (let t = 0; t < 400; t++) {
      a.tick(script(t));
      b.tick(script(t));
    }
    expect(a.saveToJson()).toEqual(b.saveToJson());
  });
});
