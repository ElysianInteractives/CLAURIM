// Inventory, equipment, consumables, loot rolling, and merchant trades.
// Functions only; state lives on actors / Sim (SimContext seam).

import type { Actor, ContentId, EntityId } from '../types';
import type { SimContext } from '../sim_context';
import type { LootTableDef } from '../content/schema';
import type { Rng } from '../rng';

export function addItem(ctx: SimContext, actorId: EntityId, itemId: ContentId, count: number): void {
  const a = ctx.actors.get(actorId);
  if (!a || count <= 0) return;
  const item = ctx.content.items[itemId];
  if (!item) return;
  const stackable = item.stackable === true;
  if (stackable) {
    const st = a.inventory.find((s) => s.itemId === itemId);
    if (st) st.count += count;
    else a.inventory.push({ itemId, count });
  } else {
    for (let i = 0; i < count; i++) a.inventory.push({ itemId, count: 1 });
  }
  ctx.emit({ type: 'itemAdded', actorId, itemId, count });
  ctx.onQuestEvent({ type: 'itemAdded', actorId, itemId, count });
}

export function removeItem(ctx: SimContext, actorId: EntityId, itemId: ContentId, count: number): boolean {
  const a = ctx.actors.get(actorId);
  if (!a) return false;
  if (countItem(ctx, actorId, itemId) < count) return false;
  let remaining = count;
  for (let i = a.inventory.length - 1; i >= 0 && remaining > 0; i--) {
    const st = a.inventory[i];
    if (st.itemId !== itemId) continue;
    const take = Math.min(st.count, remaining);
    st.count -= take;
    remaining -= take;
    if (st.count === 0) a.inventory.splice(i, 1);
  }
  // Unequip if the last copy left.
  for (const [slot, eq] of Object.entries(a.equipment)) {
    if (eq === itemId && countItem(ctx, actorId, itemId) === 0) {
      delete a.equipment[slot as keyof typeof a.equipment];
      ctx.recalcStats(actorId);
    }
  }
  ctx.emit({ type: 'itemRemoved', actorId, itemId, count });
  return true;
}

export function countItem(ctx: SimContext, actorId: EntityId, itemId: ContentId): number {
  const a = ctx.actors.get(actorId);
  if (!a) return 0;
  let n = 0;
  for (const st of a.inventory) if (st.itemId === itemId) n += st.count;
  return n;
}

export function carriedWeight(ctx: SimContext, a: Actor): number {
  let w = 0;
  for (const st of a.inventory) {
    const item = ctx.content.items[st.itemId];
    if (item) w += item.weight * st.count;
  }
  return w;
}

/** Equip an owned item into its slot (weapons -> mainHand unless shield). */
export function equipItem(ctx: SimContext, actorId: EntityId, itemId: ContentId): boolean {
  const a = ctx.actors.get(actorId);
  const item = ctx.content.items[itemId];
  if (!a || !item) return false;
  if (countItem(ctx, actorId, itemId) === 0) return false;
  if (item.kind === 'weapon') {
    a.equipment.mainHand = itemId;
  } else if (item.kind === 'armor' && item.slot) {
    a.equipment[item.slot] = itemId;
  } else {
    return false;
  }
  ctx.recalcStats(actorId);
  return true;
}

export function unequipSlot(ctx: SimContext, actorId: EntityId, slot: keyof Actor['equipment']): boolean {
  const a = ctx.actors.get(actorId);
  if (!a || a.equipment[slot] === undefined) return false;
  delete a.equipment[slot];
  ctx.recalcStats(actorId);
  return true;
}

/** Use a consumable: applies its effects and removes one. */
export function useItem(ctx: SimContext, actorId: EntityId, itemId: ContentId): boolean {
  const a = ctx.actors.get(actorId);
  const item = ctx.content.items[itemId];
  if (!a || !item || item.kind !== 'consumable') return false;
  if (!removeItem(ctx, actorId, itemId, 1)) return false;
  for (const effectId of item.useEffects ?? []) {
    ctx.applyEffect(actorId, effectId, `item:${itemId}`);
  }
  // Instant portion for restore_stamina-style tonics is modeled by the effect's
  // regen mods; direct restores can be added as an item field later (OPUS ticket).
  return true;
}

/** Roll a loot table deterministically with the sim rng. */
export function rollLoot(rng: Rng, table: LootTableDef): { items: { itemId: ContentId; count: number }[]; gold: number } {
  const items: { itemId: ContentId; count: number }[] = [];
  for (const e of table.entries) {
    if (rng.chance(e.chance)) {
      items.push({ itemId: e.itemId, count: rng.int(e.min, e.max) });
    }
  }
  const gold = table.goldMin >= table.goldMax ? table.goldMin : rng.int(table.goldMin, table.goldMax);
  return { items, gold };
}

/** Transfer everything from a dead actor to the looter. */
export function lootActor(ctx: SimContext, looterId: EntityId, corpseId: EntityId): void {
  const corpse = ctx.actors.get(corpseId);
  if (!corpse || !corpse.dead) return;
  for (const st of [...corpse.inventory]) {
    addItem(ctx, looterId, st.itemId, st.count);
  }
  corpse.inventory = [];
  const looter = ctx.actors.get(looterId);
  if (looter && corpse.gold > 0) {
    looter.gold += corpse.gold;
    corpse.gold = 0;
  }
}

// ---------------------------------------------------------------------------
// Merchant trades. Prices: buy at value * 1.25 - speech discount; sell at
// value * 0.4 + speech bonus. Speech trains on every completed trade.
// ---------------------------------------------------------------------------

export function buyPrice(ctx: SimContext, buyer: Actor, itemId: ContentId): number {
  const item = ctx.content.items[itemId];
  if (!item) return 0;
  const speech = buyer.skills.speech.level;
  const mult = Math.max(1.0, 1.25 - (speech - 1) * 0.01);
  return Math.max(1, Math.round(item.value * mult));
}

export function sellPrice(ctx: SimContext, seller: Actor, itemId: ContentId): number {
  const item = ctx.content.items[itemId];
  if (!item) return 0;
  const speech = seller.skills.speech.level;
  const mult = Math.min(0.8, 0.4 + (speech - 1) * 0.01);
  return Math.max(0, Math.round(item.value * mult));
}

export function buyFromMerchant(ctx: SimContext, playerId: EntityId, merchantId: EntityId, itemId: ContentId): boolean {
  const player = ctx.actors.get(playerId);
  const merchant = ctx.actors.get(merchantId);
  if (!player || !merchant) return false;
  if (countItem(ctx, merchantId, itemId) === 0) return false;
  const price = buyPrice(ctx, player, itemId);
  if (player.gold < price) return false;
  player.gold -= price;
  merchant.gold += price;
  removeItem(ctx, merchantId, itemId, 1);
  addItem(ctx, playerId, itemId, 1);
  ctx.trainSkill(playerId, 'speech', 2);
  return true;
}

export function sellToMerchant(ctx: SimContext, playerId: EntityId, merchantId: EntityId, itemId: ContentId): boolean {
  const player = ctx.actors.get(playerId);
  const merchant = ctx.actors.get(merchantId);
  if (!player || !merchant) return false;
  const item = ctx.content.items[itemId];
  if (!item || item.kind === 'quest') return false;
  if (countItem(ctx, playerId, itemId) === 0) return false;
  const price = sellPrice(ctx, player, itemId);
  if (merchant.gold < price) return false;
  merchant.gold -= price;
  player.gold += price;
  removeItem(ctx, playerId, itemId, 1);
  addItem(ctx, merchantId, itemId, 1);
  ctx.trainSkill(playerId, 'speech', 2);
  return true;
}
