// Active-effect lifecycle: apply (with stacking rules), per-tick DoT/HoT and
// expiry, removal. Modifier composition itself lives in modifiers.ts.

import { DT, type EntityId, type ContentId } from '../types';
import type { SimContext } from '../sim_context';

export function applyEffect(ctx: SimContext, targetId: EntityId, effectId: ContentId, source: string): void {
  const a = ctx.actors.get(targetId);
  const def = ctx.content.effects[effectId];
  if (!a || !def || a.dead) return;
  const existing = a.effects.find((e) => e.effectId === effectId);
  if (existing) {
    if (def.stackRule === 'refresh') {
      existing.remaining = def.duration;
      existing.source = source;
    } else if (def.stackRule === 'stack') {
      existing.remaining = def.duration;
      if (existing.stacks < def.maxStacks) existing.stacks += 1;
    } // 'ignore': keep the running instance
  } else {
    a.effects.push({ effectId, remaining: def.duration, stacks: 1, source });
  }
  ctx.recalcStats(targetId);
  ctx.emit({ type: 'effectApplied', targetId, effectId });
}

export function removeEffect(ctx: SimContext, targetId: EntityId, effectId: ContentId): void {
  const a = ctx.actors.get(targetId);
  if (!a) return;
  const idx = a.effects.findIndex((e) => e.effectId === effectId);
  if (idx >= 0) {
    a.effects.splice(idx, 1);
    ctx.recalcStats(targetId);
  }
}

/** Tick DoTs/HoTs and expiry for one actor. Deterministic order: array order. */
export function tickEffects(ctx: SimContext, actorId: EntityId): void {
  const a = ctx.actors.get(actorId);
  if (!a || a.dead || a.effects.length === 0) return;
  let changed = false;
  for (let i = a.effects.length - 1; i >= 0; i--) {
    const ef = a.effects[i];
    const def = ctx.content.effects[ef.effectId];
    if (!def) {
      a.effects.splice(i, 1);
      changed = true;
      continue;
    }
    if (def.dot) {
      ctx.dealDamage(actorId, 0, def.dot.perSecond * ef.stacks * DT, def.dot.channel);
    }
    if (def.hot) {
      ctx.applyHeal(actorId, def.hot.perSecond * ef.stacks * DT);
    }
    ef.remaining -= DT;
    if (ef.remaining <= 0) {
      a.effects.splice(i, 1);
      changed = true;
    }
  }
  if (changed) ctx.recalcStats(actorId);
}
