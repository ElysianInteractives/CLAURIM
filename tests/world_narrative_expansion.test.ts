import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/sim/content';
import { beginDialogue, chooseOption, currentNode, visibleChoices } from '../src/sim/dialogue/dialogue_runtime';
import { Sim, IDLE_INPUT } from '../src/sim/sim';

function npc(sim: Sim, templateId: string) {
  return [...sim.actors.values()].find((actor) => actor.templateId === templateId)!;
}

function chooseContaining(sim: Sim, session: NonNullable<ReturnType<typeof beginDialogue>>, fragment: string): void {
  const choices = visibleChoices(sim.context(), session);
  const index = choices.findIndex((choice) => choice.text.includes(fragment));
  expect(index, `${session.dialogueId}:${session.nodeId} choice containing ${fragment}`).toBeGreaterThanOrEqual(0);
  chooseOption(sim.context(), session, index);
}

function tickReach(sim: Sim): void {
  for (let tick = 0; tick < 12; tick++) sim.tick(IDLE_INPUT);
}

describe('QA Phase L original Thornmere narrative expansion', () => {
  it('gives every Thornmere resident a resolvable, state-aware dialogue', () => {
    for (const id of ['tamsin', 'corren', 'vael']) {
      const actor = CONTENT.actors[id];
      expect(actor.dialogueId, id).toBeTruthy();
      expect(CONTENT.dialogues[actor.dialogueId!], id).toBeTruthy();
    }
    expect(Object.keys(CONTENT.quests)).toEqual(expect.arrayContaining(['hollow_delve', 'bitter_root', 'stone_toll']));
  });

  it('plays A Bitter Root through discovery, den combat, save/load, and its visible turn-in', () => {
    let sim = new Sim(42);
    const opening = beginDialogue(sim.context(), 'p1', npc(sim, 'tamsin').id)!;
    expect(currentNode(sim.context(), opening)?.id).toBe('greet');
    chooseContaining(sim, opening, 'south road');
    chooseContaining(sim, opening, "We'll clear Gloamroot");
    expect(sim.questLogOf('p1').get('bitter_root')?.stageId).toBe('trail');

    sim.transitionTo('kaldwyn', -10, -105, 0);
    tickReach(sim);
    expect(sim.questLogOf('p1').get('bitter_root')?.stageId).toBe('sounder');

    sim.transitionTo('gloamroot_hollow', 0, 27, 0);
    const boars = [...sim.actors.values()].filter((actor) => actor.spawnerId === 'sp_gloamroot_boars');
    expect(boars).toHaveLength(4);
    for (const boar of boars) sim.context().dealDamage(boar.id, sim.player().id, 10000, 'physical');
    const matriarch = [...sim.actors.values()].find((actor) => actor.spawnerId === 'sp_gloamroot_matriarch')!;
    sim.context().dealDamage(matriarch.id, sim.player().id, 10000, 'physical');
    expect(sim.questLogOf('p1').get('bitter_root')?.stageId).toBe('return');

    sim = Sim.load(sim.saveToJson());
    const goldBefore = sim.player().gold;
    const returnScene = beginDialogue(sim.context(), 'p1', npc(sim, 'tamsin').id)!;
    expect(returnScene.nodeId).toBe('turnin');
    expect(sim.questLogOf('p1').get('bitter_root')?.completed).toBe(true);
    expect(sim.player().gold).toBe(goldBefore + 120);
    expect(sim.context().countItem(sim.player().id, 'healing_draught')).toBeGreaterThanOrEqual(3);
    chooseContaining(sim, returnScene, 'matriarch is dead');
    expect(currentNode(sim.context(), returnScene)?.id).toBe('reward');
  });

  it('plays The Stone Toll through landmark investigation and its visible turn-in', () => {
    let sim = new Sim(84);
    const opening = beginDialogue(sim.context(), 'p1', npc(sim, 'vael').id)!;
    chooseContaining(sim, opening, 'What rang');
    chooseContaining(sim, opening, "We'll investigate");
    expect(sim.questLogOf('p1').get('stone_toll')?.stageId).toBe('listen');

    sim.transitionTo('kaldwyn', 93, 274, 0);
    tickReach(sim);
    expect(sim.questLogOf('p1').get('stone_toll')?.stageId).toBe('clear');
    const boars = [...sim.actors.values()].filter((actor) => actor.spawnerId === 'sp_stones_boars');
    expect(boars).toHaveLength(2);
    for (const boar of boars) sim.context().dealDamage(boar.id, sim.player().id, 10000, 'physical');
    expect(sim.questLogOf('p1').get('stone_toll')?.stageId).toBe('return');

    sim = Sim.load(sim.saveToJson());
    const goldBefore = sim.player().gold;
    const returnScene = beginDialogue(sim.context(), 'p1', npc(sim, 'vael').id)!;
    expect(returnScene.nodeId).toBe('turnin');
    expect(sim.questLogOf('p1').get('stone_toll')?.completed).toBe(true);
    expect(sim.player().gold).toBe(goldBefore + 85);
    expect(sim.context().countItem(sim.player().id, 'stamina_tonic')).toBeGreaterThanOrEqual(2);
  });

  it('lets Corren respond to the active and completed Gloamroot quest states', () => {
    const sim = new Sim(126);
    sim.playerStartQuest('bitter_root');
    const hint = beginDialogue(sim.context(), 'p1', npc(sim, 'corren').id)!;
    expect(hint.nodeId).toBe('hint');

    const quest = sim.questLogOf('p1').get('bitter_root')!;
    quest.completed = true;
    quest.stageId = 'done';
    const after = beginDialogue(sim.context(), 'p1', npc(sim, 'corren').id)!;
    expect(after.nodeId).toBe('after');
  });
});
