// Dialogue runtime: condition evaluation, entry-node selection, choice
// filtering, and action execution. PER-CHARACTER (D-013/D-020): every session
// belongs to one character; conditions read that character's journal,
// inventory, and skills. Multiple characters may hold independent parallel
// sessions with the same NPC (MMO phase-style conversation).

import type { CharacterId, ContentId, EntityId } from '../types';
import type { SimContext } from '../sim_context';
import type {
  DialogueActionDef,
  DialogueChoiceDef,
  DialogueConditionDef,
  DialogueNodeDef,
} from '../content/schema';
import { startQuest } from '../quests/quest_runtime';

export function evalCondition(ctx: SimContext, charId: CharacterId, cond: DialogueConditionDef): boolean {
  const actor = ctx.actorByCharId(charId);
  if (!actor) return false;
  const log = ctx.questLogOf(charId);
  switch (cond.kind) {
    case 'questAtStage': {
      const q = log.get(cond.questId);
      return !!q && !q.completed && q.stageId === cond.stageId;
    }
    case 'questNotStarted':
      return !log.has(cond.questId);
    case 'questCompleted': {
      const q = log.get(cond.questId);
      return !!q && q.completed;
    }
    case 'hasItem':
      return ctx.countItem(actor.id, cond.itemId) >= cond.count;
    case 'skillAtLeast':
      return actor.skills[cond.skill].level >= cond.level;
  }
}

export function evalConditions(
  ctx: SimContext,
  charId: CharacterId,
  conds: DialogueConditionDef[] | undefined,
): boolean {
  if (!conds) return true;
  return conds.every((c) => evalCondition(ctx, charId, c));
}

export interface DialogueSession {
  charId: CharacterId;
  npcId: EntityId;
  dialogueId: ContentId;
  nodeId: string;
  /** Set when a choice ran openShop; the host opens the trade UI. */
  shopRequested: boolean;
}

/** Begin talking to an NPC as a specific character. Emits 'talkedTo' (quest
 * credit for that character only). */
export function beginDialogue(ctx: SimContext, charId: CharacterId, npcId: EntityId): DialogueSession | null {
  const npc = ctx.actors.get(npcId);
  const playerActor = ctx.actorByCharId(charId);
  if (!npc || npc.dead || !playerActor) return null;
  const tpl = ctx.content.actors[npc.templateId];
  if (!tpl?.dialogueId) return null;
  const def = ctx.content.dialogues[tpl.dialogueId];
  if (!def) return null;
  ctx.emit({ type: 'talkedTo', playerId: playerActor.id, npcTemplateId: npc.templateId });
  ctx.onQuestEvent({ type: 'talkedTo', playerId: playerActor.id, npcTemplateId: npc.templateId });
  for (const entry of def.entries) {
    if (evalConditions(ctx, charId, entry.conditions)) {
      return { charId, npcId, dialogueId: def.id, nodeId: entry.node, shopRequested: false };
    }
  }
  return null;
}

export function currentNode(ctx: SimContext, session: DialogueSession): DialogueNodeDef | null {
  const def = ctx.content.dialogues[session.dialogueId];
  return def?.nodes.find((n) => n.id === session.nodeId) ?? null;
}

/** Choices visible for the current node (conditions applied per character). */
export function visibleChoices(ctx: SimContext, session: DialogueSession): DialogueChoiceDef[] {
  const node = currentNode(ctx, session);
  if (!node) return [];
  return node.choices.filter((c) => evalConditions(ctx, session.charId, c.conditions));
}

function runAction(ctx: SimContext, session: DialogueSession, action: DialogueActionDef): void {
  const actor = ctx.actorByCharId(session.charId);
  if (!actor) return;
  switch (action.kind) {
    case 'startQuest':
      startQuest(ctx, session.charId, action.questId);
      break;
    case 'advanceQuest': {
      const q = ctx.questLogOf(session.charId).get(action.questId);
      if (q && !q.completed) q.stageId = action.stageId;
      break;
    }
    case 'giveItem':
      ctx.addItem(actor.id, action.itemId, action.count);
      break;
    case 'takeItem':
      ctx.removeItem(actor.id, action.itemId, action.count);
      break;
    case 'giveGold':
      actor.gold += action.amount;
      break;
    case 'openShop':
      session.shopRequested = true;
      break;
    case 'trainSkillXp':
      ctx.trainSkill(actor.id, action.skill, action.amount);
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
