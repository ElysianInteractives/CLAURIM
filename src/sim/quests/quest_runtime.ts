// Quest runtime: explicit, testable state machines interpreted from content
// data. MULTIPLAYER MODEL (D-020): journals are PER-CHARACTER. Credit rules:
//   kill      killer's journal + party members within ENGAGE_RADIUS, same space
//   collect   personal (tracks that character's inventory)
//   talkTo    personal
//   reach     personal (positional poll per character)
//   interact  personal (the interacting character), party-shared for doors
// Rewards grant to the completing character only.

import {
  ENGAGE_RADIUS,
  type CharacterId,
  type ContentId,
  type QuestState,
  type SimEvent,
} from '../types';
import type { SimContext } from '../sim_context';
import type { ObjectiveDef, QuestStageDef } from '../content/schema';
import { grantCharacterXp } from '../progression/skills';

export function startQuest(ctx: SimContext, charId: CharacterId, questId: ContentId): boolean {
  const log = ctx.questLogOf(charId);
  if (log.has(questId)) return false;
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
  log.set(questId, state);
  ctx.emit({ type: 'questStarted', charId, questId });
  recheckCollectObjectives(ctx, charId, state);
  maybeAdvance(ctx, charId, state);
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

function creditObjective(
  ctx: SimContext,
  charId: CharacterId,
  state: QuestState,
  obj: ObjectiveDef,
  amount: number,
): void {
  const prog = state.objectives[obj.id];
  if (!prog || prog.done) return;
  prog.count = Math.min(obj.count, prog.count + amount);
  if (prog.count >= obj.count) prog.done = true;
  ctx.emit({
    type: 'objectiveProgress',
    charId,
    questId: state.questId,
    objectiveId: obj.id,
    progress: prog.count,
    required: obj.count,
  });
}

/** Collect objectives track CURRENT possession of that character. */
function recheckCollectObjectives(ctx: SimContext, charId: CharacterId, state: QuestState): void {
  const stage = currentStage(ctx, state);
  const actor = ctx.actorByCharId(charId);
  if (!stage || !actor) return;
  for (const obj of stage.objectives) {
    if (obj.kind !== 'collect') continue;
    const prog = state.objectives[obj.id];
    if (!prog || prog.done) continue;
    const have = ctx.countItem(actor.id, obj.target);
    if (have !== prog.count) {
      prog.count = Math.min(obj.count, have);
      if (prog.count >= obj.count) prog.done = true;
      ctx.emit({
        type: 'objectiveProgress',
        charId,
        questId: state.questId,
        objectiveId: obj.id,
        progress: prog.count,
        required: obj.count,
      });
    }
  }
}

function maybeAdvance(ctx: SimContext, charId: CharacterId, state: QuestState): void {
  const stage = currentStage(ctx, state);
  if (!stage) return;
  for (const obj of stage.objectives) {
    if (obj.optional) continue;
    if (!state.objectives[obj.id]?.done) return;
  }
  if (stage.next === 'done') {
    state.completed = true;
    state.stageId = 'done';
    const def = ctx.content.quests[state.questId]!;
    const actor = ctx.actorByCharId(charId);
    if (actor) {
      actor.gold += def.reward.gold;
      for (const it of def.reward.items) ctx.addItem(actor.id, it.itemId, it.count);
      grantCharacterXp(ctx, actor.id, def.reward.xp);
    }
    ctx.emit({ type: 'questCompleted', charId, questId: state.questId });
  } else {
    const def = ctx.content.quests[state.questId]!;
    const next = def.stages.find((s) => s.id === stage.next);
    if (!next) return;
    state.stageId = next.id;
    initStageObjectives(state, next);
    ctx.emit({ type: 'questAdvanced', charId, questId: state.questId, stageId: next.id });
    recheckCollectObjectives(ctx, charId, state);
    maybeAdvance(ctx, charId, state);
  }
}

/** Characters eligible for shared kill credit: the killer plus party members
 * in the same space within ENGAGE_RADIUS. */
function killCreditRecipients(ctx: SimContext, killerEntityId: number): CharacterId[] {
  const killerChar = ctx.charIdOf(killerEntityId);
  if (!killerChar) return [];
  const killer = ctx.actorByCharId(killerChar);
  if (!killer) return [];
  const out: CharacterId[] = [];
  for (const member of ctx.partyMembersOf(killerChar)) {
    const actor = ctx.actorByCharId(member);
    if (!actor || actor.dead) continue;
    if (member !== killerChar) {
      if (actor.pos.spaceId !== killer.pos.spaceId) continue;
      const d = Math.hypot(actor.pos.x - killer.pos.x, actor.pos.z - killer.pos.z);
      if (d > ENGAGE_RADIUS) continue;
    }
    out.push(member);
  }
  return out;
}

/** The event feed. Sim calls this for kill / item / talk / reach / interact. */
export function onQuestEvent(ctx: SimContext, e: SimEvent): void {
  // Resolve which characters this event can credit.
  let recipients: CharacterId[] = [];
  switch (e.type) {
    case 'death':
      recipients = killCreditRecipients(ctx, e.sourceId);
      break;
    case 'itemAdded':
    case 'itemRemoved': {
      const c = ctx.charIdOf(e.actorId);
      if (c) recipients = [c];
      break;
    }
    case 'talkedTo': {
      const c = ctx.charIdOf(e.playerId);
      if (c) recipients = [c];
      break;
    }
    case 'interacted': {
      const c = ctx.charIdOf(e.actorId);
      if (c) recipients = [c];
      break;
    }
    default:
      return;
  }
  for (const charId of recipients) {
    const log = ctx.questLogOf(charId);
    for (const state of log.values()) {
      if (state.completed || state.failed) continue;
      const stage = currentStage(ctx, state);
      if (!stage) continue;
      let touched = false;
      for (const obj of stage.objectives) {
        switch (obj.kind) {
          case 'kill':
            if (e.type === 'death' && e.templateId === obj.target) {
              creditObjective(ctx, charId, state, obj, 1);
              touched = true;
            }
            break;
          case 'collect':
            if ((e.type === 'itemAdded' || e.type === 'itemRemoved') && e.itemId === obj.target) {
              recheckCollectObjectives(ctx, charId, state);
              touched = true;
            }
            break;
          case 'talkTo':
            if (e.type === 'talkedTo' && e.npcTemplateId === obj.target) {
              creditObjective(ctx, charId, state, obj, 1);
              touched = true;
            }
            break;
          case 'interact':
            if (e.type === 'interacted' && e.targetId === obj.target) {
              creditObjective(ctx, charId, state, obj, 1);
              touched = true;
            }
            break;
          case 'reach':
            break;
        }
      }
      if (touched) maybeAdvance(ctx, charId, state);
    }
  }
}

/** Positional 'reach' objectives, polled by Sim every few ticks, per character. */
export function tickReachObjectives(ctx: SimContext): void {
  for (const charId of ctx.playerCharIds()) {
    const actor = ctx.actorByCharId(charId);
    if (!actor || actor.dead) continue;
    const log = ctx.questLogOf(charId);
    for (const state of log.values()) {
      if (state.completed || state.failed) continue;
      const stage = currentStage(ctx, state);
      if (!stage) continue;
      let touched = false;
      for (const obj of stage.objectives) {
        if (obj.kind !== 'reach') continue;
        const prog = state.objectives[obj.id];
        if (!prog || prog.done) continue;
        const [spaceId, xs, zs, rs] = obj.target.split(':');
        if (actor.pos.spaceId !== spaceId) continue;
        const dx = actor.pos.x - Number(xs);
        const dz = actor.pos.z - Number(zs);
        if (dx * dx + dz * dz <= Number(rs) * Number(rs)) {
          creditObjective(ctx, charId, state, obj, 1);
          touched = true;
        }
      }
      if (touched) maybeAdvance(ctx, charId, state);
    }
  }
}

/** Journal view for one character. */
export function journalFor(ctx: SimContext, charId: CharacterId): {
  questId: ContentId;
  name: string;
  stageJournal: string;
  completed: boolean;
  objectives: { text: string; progress: number; required: number; done: boolean; optional: boolean }[];
}[] {
  const out = [];
  for (const state of ctx.questLogOf(charId).values()) {
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
