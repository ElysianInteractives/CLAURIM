// The Hollow Delve, end to end through the real runtime: dialogue acquisition,
// kill + reach + collect + talkTo objectives, stage advancement, optional
// objective, reward grant, and save/load continuation at every stage.
// Multiplayer additions live in tests/multiplayer_sim.test.ts; this file
// pins the single-character path through the same per-character runtime.

import { describe, expect, it } from 'vitest';
import { Sim, type PlayerInput } from '../src/sim/sim';
import { beginDialogue, chooseOption, visibleChoices } from '../src/sim/dialogue/dialogue_runtime';

const idle: PlayerInput = { moveX: 0, moveZ: 0, yaw: 0, pitch: 0, sprint: false, sneak: false, block: false, jump: false };

/** Drive the quest to completion, save/reload at each stage boundary. */
function runQuest(reloadEachStage: boolean): Sim {
  let sim = new Sim(555);

  // --- acquire via Maera's dialogue ---------------------------------------
  const maera = [...sim.actors.values()].find((a) => a.templateId === 'maera')!;
  const session = beginDialogue(sim.context(), 'p1', maera.id)!;
  expect(session).toBeTruthy();
  const greetChoices = visibleChoices(sim.context(), session).map((c) => c.text);
  const tellIdx = greetChoices.findIndex((t) => t.includes('work'));
  expect(tellIdx).toBeGreaterThanOrEqual(0);
  chooseOption(sim.context(), session, tellIdx);
  const offerChoices = visibleChoices(sim.context(), session).map((c) => c.text);
  const acceptIdx = offerChoices.findIndex((t) => t.includes('take the job'));
  chooseOption(sim.context(), session, acceptIdx);
  expect(sim.questLogOf('p1').get('hollow_delve')?.stageId).toBe('entrance');

  const reload = () => {
    if (reloadEachStage) sim = Sim.load(sim.saveToJson());
  };

  // --- stage entrance: kill 2 raiders + reach the mine gate ---------------
  reload();
  let killed = 0;
  for (const a of [...sim.actors.values()]) {
    if (a.templateId === 'redclaw_raider' && a.spawnerId === 'sp_gate_raiders' && killed < 2) {
      sim.context().dealDamage(a.id, sim.player().id, 10000, 'physical');
      killed++;
    }
  }
  expect(killed).toBe(2);
  sim.transitionTo('kaldwyn', 118, 338, 0);
  for (let t = 0; t < 12; t++) sim.tick(idle);
  expect(sim.questLogOf('p1').get('hollow_delve')?.stageId).toBe('delve');

  // --- stage delve: find the journal (container in the boss vault) --------
  reload();
  sim.transitionTo('duskhollow_mine', 6, 66, 0);
  // Park the boss for this stage-focused test (boss combat is covered by the
  // multiplayer suite + benchmarks).
  const boss = [...sim.actors.values()].find((a) => a.templateId === 'barrow_wight')!;
  boss.pos = { spaceId: 'duskhollow_mine', x: 0, y: 0, z: 55 };
  boss.brain!.homePos = { ...boss.pos };
  boss.brain!.state = 'idle';
  const res = sim.interact();
  expect(res).toBe('container');
  expect(sim.lootTakeAllFor('p1')).toBe(true);
  expect(sim.questLogOf('p1').get('hollow_delve')?.stageId).toBe('warden');

  // --- stage warden: slay the Pale Warden ---------------------------------
  reload();
  const boss2 = [...sim.actors.values()].find((a) => a.templateId === 'barrow_wight')!;
  sim.context().dealDamage(boss2.id, sim.player().id, 100000, 'physical');
  expect(sim.questLogOf('p1').get('hollow_delve')?.stageId).toBe('return');

  // --- stage return: tell Maera -------------------------------------------
  reload();
  const maera2 = [...sim.actors.values()].find((a) => a.templateId === 'maera')!;
  const goldBefore = sim.player().gold;
  const s2 = beginDialogue(sim.context(), 'p1', maera2.id);
  expect(s2).toBeTruthy();
  expect(s2?.nodeId).toBe('turnin');
  const q = sim.questLogOf('p1').get('hollow_delve')!;
  expect(q.completed).toBe(true);
  expect(sim.player().gold).toBe(goldBefore + 150);
  expect(sim.context().countItem(sim.player().id, 'healing_draught')).toBeGreaterThanOrEqual(3);

  return sim;
}

describe('The Hollow Delve', () => {
  it('completes end to end in one session', () => {
    runQuest(false);
  });

  it('completes with a save/load at every stage boundary', () => {
    runQuest(true);
  });

  it('journal reflects stage and objectives', () => {
    const sim = new Sim(555);
    sim.playerStartQuest('hollow_delve');
    const j = sim.journal();
    expect(j.length).toBe(1);
    expect(j[0].name).toBe('The Hollow Delve');
    expect(j[0].objectives.length).toBe(2);
    expect(j[0].objectives[0].required).toBe(2);
  });

  it('merchant shop works through dialogue', () => {
    const sim = new Sim(555);
    const maera = [...sim.actors.values()].find((a) => a.templateId === 'maera')!;
    const session = beginDialogue(sim.context(), 'p1', maera.id)!;
    const choices = visibleChoices(sim.context(), session).map((c) => c.text);
    const shopIdx = choices.findIndex((t) => t.includes('goods'));
    expect(shopIdx).toBeGreaterThanOrEqual(0);
    sim.dialogueSessions.set('p1', session);
    sim.dialogueChoose(shopIdx);
    expect(sim.shopMerchantId).toBe(maera.id);
    const before = sim.context().countItem(sim.player().id, 'healing_draught');
    sim.player().gold = 100;
    expect(sim.shopBuy('healing_draught')).toBe(true);
    expect(sim.context().countItem(sim.player().id, 'healing_draught')).toBe(before + 1);
    expect(sim.shopBuy('iron_axe')).toBe(true);
    expect(sim.context().countItem(sim.player().id, 'iron_axe')).toBe(1);
    expect(sim.shopSell('bread')).toBe(true);
  });
});
