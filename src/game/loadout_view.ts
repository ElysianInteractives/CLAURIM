import type { ContentRegistry } from '../sim/content/schema';
import {
  EQUIP_SLOTS,
  SPELL_EQUIP_SLOTS,
  type Actor,
  type ContentId,
  type EquipSlot,
} from '../sim/types';
import type { SpellLoadout } from '../sim/player/loadout';
import { MAGIC_SCHOOL_NAMES } from '../sim/content/magic';
import type {
  EquipmentSlotView,
  EquippedSpellView,
  InventoryItemView,
  KnownSpellView,
} from '../world_api';

const EQUIPMENT_LABELS: Record<EquipSlot, string> = {
  mainHand: 'Main hand',
  offHand: 'Off hand',
  body: 'Body',
  head: 'Head',
  feet: 'Feet',
  amulet: 'Amulet',
};

export function inventoryView(actor: Actor, content: ContentRegistry): InventoryItemView[] {
  const totals = new Map<ContentId, number>();
  for (const stack of actor.inventory) totals.set(stack.itemId, (totals.get(stack.itemId) ?? 0) + stack.count);
  const equippedCounts = new Map<ContentId, number>();
  for (const itemId of Object.values(actor.equipment)) {
    if (itemId) equippedCounts.set(itemId, (equippedCounts.get(itemId) ?? 0) + 1);
  }
  const view: InventoryItemView[] = [];
  for (const [itemId, total] of totals) {
    const item = content.items[itemId];
    const equippedCount = Math.min(total, equippedCounts.get(itemId) ?? 0);
    const makeEntry = (count: number, equipped: boolean): InventoryItemView => ({
      itemId,
      name: item?.name ?? itemId,
      count,
      equipped,
      kind: item?.kind ?? 'misc',
      value: item?.value ?? 0,
    });
    if (equippedCount > 0) view.push(makeEntry(equippedCount, true));
    if (total > equippedCount) view.push(makeEntry(total - equippedCount, false));
  }
  return view;
}

export function equipmentView(actor: Actor, content: ContentRegistry): EquipmentSlotView[] {
  return EQUIP_SLOTS.map((slot) => {
    const itemId = actor.equipment[slot] ?? null;
    const item = itemId ? content.items[itemId] : undefined;
    return {
      slot,
      label: EQUIPMENT_LABELS[slot],
      itemId,
      name: itemId ? (item?.name ?? itemId) : null,
      kind: item?.kind ?? null,
    };
  });
}

export function knownSpellView(known: readonly ContentId[], content: ContentRegistry): KnownSpellView[] {
  return known.map((id) => {
    const spell = content.spells[id];
    return {
      id,
      name: spell?.name ?? id,
      cost: spell?.magickaCost ?? 0,
      school: spell?.school ?? 'ruinweaving',
      schoolName: spell ? MAGIC_SCHOOL_NAMES[spell.school] : 'Unknown discipline',
    };
  }).sort((a, b) => a.schoolName.localeCompare(b.schoolName) || a.name.localeCompare(b.name));
}

export function equippedSpellView(loadout: SpellLoadout, content: ContentRegistry): EquippedSpellView[] {
  return SPELL_EQUIP_SLOTS.map((slot, index) => {
    const spellId = loadout[slot] ?? null;
    const spell = spellId ? content.spells[spellId] : undefined;
    return {
      slot,
      hotkey: index === 0 ? '1' : '2',
      spellId,
      name: spellId ? (spell?.name ?? spellId) : null,
      cost: spell?.magickaCost ?? null,
    };
  });
}
