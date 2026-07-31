// Dialogue runtime: condition evaluation, entry-node selection, choice
// filtering, and action execution. Dialogue trees are DATA (content/quests.ts).

import type { ContentId, EntityId } from '../types';
import type { SimContext } from '../sim_context';
import type {
  DialogueActionDef,
  DialogueChoiceDef,
  DialogueConditionDef,
  DialogueNodeDef,
} from '../content/schema';
import { startQuest } from '../quests/quest_runtime';

export function evalCondition(ctx: SimContext, cond: DialogueConditionDef): boolean {
  switch (cond.kind) {
    case 'questAtStage': {
      const q = ctx.quests.get(cond.questId);
      return !!q && !q.completed && q.stageId === cond.stageId;
    }
    case 'questNotStarted':
      return !ctx.quests.has(cond.questId);
    case 'questCompleted': {
      const q = ctx.quests.get(cond.questId);
      return !!q && q.completed;
    }
    case 'hasItem':
      return ctx.countItem(ctx.playerId(), cond.itemId) >= cond.count;
    case 'skillAtLeast':
      return ctx.player().skills[cond.skill].level >= cond.level;
  }
}

export function evalConditions(ctx: SimContext, conds: DialogueConditionDef[] | undefined): boolean {
  if (!conds) return true;
  return conds.every((c) => evalCondition(ctx, c));
}

export interface DialogueSession {
  npcId: EntityId;
  dialogueId: ContentId;
  nodeId: string;
  /** Set when a choice ran openShop; the host opens the trade UI. */
  shopRequested: boolean;
}

/** Begin talking to an NPC. Emits 'talkedTo' (quest credit) and returns the
 * session, or null when the NPC has no dialogue. */
export function beginDialogue(ctx: SimContext, npcId: EntityId): DialogueSession | null {
  const npc = ctx.actors.get(npcId);
  if (!npc || npc.dead) return null;
  const tpl = ctx.content.actors[npc.templateId];
  if (!tpl?.dialogueId) return null;
  const def = ctx.content.dialogues[tpl.dialogueId];
  if (!def) return null;
  ctx.emit({ type: 'talkedTo', npcTemplateId: npc.templateId });
  ctx.onQuestEvent({ type: 'talkedTo', npcTemplateId: npc.templateId });
  for (const entry of def.entries) {
    if (evalConditions(ctx, entry.conditions)) {
      return { npcId, dialogueId: def.id, nodeId: entry.node, shopRequested: false };
    }
  }
  return null;
}

export function currentNode(ctx: SimContext, session: DialogueSession): DialogueNodeDef | null {
  const def = ctx.content.dialogues[session.dialogueId];
  return def?.nodes.find((n) => n.id === session.nodeId) ?? null;
}

/** Choices visible for the current node (conditions applied). */
export function visibleChoices(ctx: SimContext, session: DialogueSession): DialogueChoiceDef[] {
  const node = currentNode(ctx, session);
  if (!node) return [];
  return node.choices.filter((c) => evalConditions(ctx, c.conditions));
}

function runAction(ctx: SimContext, session: DialogueSession, action: DialogueActionDef): void {
  const pid = ctx.playerId();
  switch (action.kind) {
    case 'startQuest':
      startQuest(ctx, action.questId);
      break;
    case 'advanceQuest': {
      const q = ctx.quests.get(action.questId);
      if (q && !q.completed) {
        q.stageId = action.stageId;
      }
      break;
    }
    case 'giveItem':
      ctx.addItem(pid, action.itemId, action.count);
      break;
    case 'takeItem':
      ctx.removeItem(pid, action.itemId, action.count);
      break;
    case 'giveGold':
      ctx.player().gold += action.amount;
      break;
    case 'openShop':
      session.shopRequested = true;
      break;
    case 'trainSkillXp':
      ctx.trainSkill(pid, action.skill, action.amount);
      break;
  }
}

/** Pick a visible choice by index. Returns false when the session ended. */
export function chooseOption(ctx: SimContext, session: DialogueSession, index: number): boolean {
  const choices = visibleChoices(ctx, session);
  const choice = choices[index];
  if (!choice) return false;
  for (const a of choice.actions ?? []) runAction(ctx, session, a);
  if (choice.next === 'end') return false;
  session.nodeId = choice.next;
  return true;
}
