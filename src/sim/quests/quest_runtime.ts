// Quest runtime: an explicit, testable state machine. Quest logic is DATA
// (content/quests.ts); this module interprets it. Progression is event-driven:
// Sim feeds SimEvents into onQuestEvent, objectives accumulate, stages advance
// when all non-optional objectives complete, rewards grant on 'done'.

import type { ContentId, QuestState, SimEvent } from '../types';
import type { SimContext } from '../sim_context';
import type { ObjectiveDef, QuestStageDef } from '../content/schema';
import { grantCharacterXp } from '../progression/skills';

export function startQuest(ctx: SimContext, questId: ContentId): boolean {
  if (ctx.quests.has(questId)) return false;
  const def = ctx.content.quests[questId];
  if (!def) return false;
  const first = def.stages[0];
  const state: QuestState = {
    questId,
    stageId: first.id,
    objectives: {},
    completed: false,
    failed: false,
  };
  initStageObjectives(state, first);
  ctx.quests.set(questId, state);
  ctx.emit({ type: 'questStarted', questId });
  // Retroactive credit: items already carried count for collect objectives.
  recheckCollectObjectives(ctx, state);
  maybeAdvance(ctx, state);
  return true;
}

function initStageObjectives(state: QuestState, stage: QuestStageDef): void {
  state.objectives = {};
  for (const o of stage.objectives) {
    state.objectives[o.id] = { count: 0, done: false };
  }
}

function currentStage(ctx: SimContext, state: QuestState): QuestStageDef | null {
  const def = ctx.content.quests[state.questId];
  if (!def) return null;
  return def.stages.find((s) => s.id === state.stageId) ?? null;
}

function creditObjective(ctx: SimContext, state: QuestState, obj: ObjectiveDef, amount: number): void {
  const prog = state.objectives[obj.id];
  if (!prog || prog.done) return;
  prog.count = Math.min(obj.count, prog.count + amount);
  if (prog.count >= obj.count) prog.done = true;
  ctx.emit({
    type: 'objectiveProgress',
    questId: state.questId,
    objectiveId: obj.id,
    progress: prog.count,
    required: obj.count,
  });
}

/** Collect objectives track CURRENT possession, so recheck from inventory. */
function recheckCollectObjectives(ctx: SimContext, state: QuestState): void {
  const stage = currentStage(ctx, state);
  if (!stage) return;
  for (const obj of stage.objectives) {
    if (obj.kind !== 'collect') continue;
    const prog = state.objectives[obj.id];
    if (!prog || prog.done) continue;
    const have = ctx.countItem(ctx.playerId(), obj.target);
    if (have !== prog.count) {
      prog.count = Math.min(obj.count, have);
      if (prog.count >= obj.count) prog.done = true;
      ctx.emit({
        type: 'objectiveProgress',
        questId: state.questId,
        objectiveId: obj.id,
        progress: prog.count,
        required: obj.count,
      });
    }
  }
}

function maybeAdvance(ctx: SimContext, state: QuestState): void {
  const stage = currentStage(ctx, state);
  if (!stage) return;
  for (const obj of stage.objectives) {
    if (obj.optional) continue;
    if (!state.objectives[obj.id]?.done) return;
  }
  // Advance.
  if (stage.next === 'done') {
    state.completed = true;
    state.stageId = 'done';
    const def = ctx.content.quests[state.questId]!;
    const pid = ctx.playerId();
    const player = ctx.player();
    player.gold += def.reward.gold;
    for (const it of def.reward.items) ctx.addItem(pid, it.itemId, it.count);
    grantCharacterXp(ctx, pid, def.reward.xp);
    ctx.emit({ type: 'questCompleted', questId: state.questId });
  } else {
    const def = ctx.content.quests[state.questId]!;
    const next = def.stages.find((s) => s.id === stage.next);
    if (!next) return;
    state.stageId = next.id;
    initStageObjectives(state, next);
    ctx.emit({ type: 'questAdvanced', questId: state.questId, stageId: next.id });
    recheckCollectObjectives(ctx, state);
    maybeAdvance(ctx, state); // cascades if the next stage is already satisfied
  }
}

/** The event feed. Sim calls this for kill / item / talk / reach / interact. */
export function onQuestEvent(ctx: SimContext, e: SimEvent): void {
  for (const state of ctx.quests.values()) {
    if (state.completed || state.failed) continue;
    const stage = currentStage(ctx, state);
    if (!stage) continue;
    let touched = false;
    for (const obj of stage.objectives) {
      switch (obj.kind) {
        case 'kill':
          if (e.type === 'death' && e.templateId === obj.target && e.sourceId === ctx.playerId()) {
            creditObjective(ctx, state, obj, 1);
            touched = true;
          }
          break;
        case 'collect':
          if ((e.type === 'itemAdded' || e.type === 'itemRemoved') && e.actorId === ctx.playerId() && e.itemId === obj.target) {
            recheckCollectObjectives(ctx, state);
            touched = true;
          }
          break;
        case 'talkTo':
          if (e.type === 'talkedTo' && e.npcTemplateId === obj.target) {
            creditObjective(ctx, state, obj, 1);
            touched = true;
          }
          break;
        case 'reach':
          if (e.type === 'spaceEntered') {
            // reach targets are checked positionally by tickReachObjectives.
          }
          break;
        case 'interact':
          if (e.type === 'interacted' && e.targetId === obj.target) {
            creditObjective(ctx, state, obj, 1);
            touched = true;
          }
          break;
      }
    }
    if (touched) maybeAdvance(ctx, state);
  }
}

/** Positional 'reach' objectives, polled by Sim every few ticks. */
export function tickReachObjectives(ctx: SimContext): void {
  const player = ctx.player();
  for (const state of ctx.quests.values()) {
    if (state.completed || state.failed) continue;
    const stage = currentStage(ctx, state);
    if (!stage) continue;
    let touched = false;
    for (const obj of stage.objectives) {
      if (obj.kind !== 'reach') continue;
      const prog = state.objectives[obj.id];
      if (!prog || prog.done) continue;
      const [spaceId, xs, zs, rs] = obj.target.split(':');
      if (player.pos.spaceId !== spaceId) continue;
      const dx = player.pos.x - Number(xs);
      const dz = player.pos.z - Number(zs);
      if (dx * dx + dz * dz <= Number(rs) * Number(rs)) {
        creditObjective(ctx, state, obj, 1);
        touched = true;
      }
    }
    if (touched) maybeAdvance(ctx, state);
  }
}

/** Journal view: current stage text + objective progress for the UI. */
export function journalFor(ctx: SimContext): {
  questId: ContentId;
  name: string;
  stageJournal: string;
  completed: boolean;
  objectives: { text: string; progress: number; required: number; done: boolean; optional: boolean }[];
}[] {
  const out = [];
  for (const state of ctx.quests.values()) {
    const def = ctx.content.quests[state.questId];
    if (!def) continue;
    if (state.completed) {
      out.push({
        questId: state.questId,
        name: def.name,
        stageJournal: 'Completed.',
        completed: true,
        objectives: [],
      });
      continue;
    }
    const stage = def.stages.find((s) => s.id === state.stageId);
    if (!stage) continue;
    out.push({
      questId: state.questId,
      name: def.name,
      stageJournal: stage.journal,
      completed: false,
      objectives: stage.objectives.map((o) => ({
        text: o.text,
        progress: state.objectives[o.id]?.count ?? 0,
        required: o.count,
        done: state.objectives[o.id]?.done ?? false,
        optional: o.optional ?? false,
      })),
    });
  }
  return out;
}
