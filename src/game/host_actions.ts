// Browser-host command selection from authored content. This keeps host input
// dispatch data-driven without exposing a new simulation command.

import { CONTENT } from '../sim/content';

type EquippedItemView = {
  itemId: string | null;
  kind: string | null;
};

export function equippedAttackKind(equipment: readonly EquippedItemView[]): 'melee' | 'ranged' {
  const weapon = equipment.find((item) => item.kind === 'weapon');
  return weapon?.itemId && CONTENT.items[weapon.itemId]?.kind === 'weapon' && CONTENT.items[weapon.itemId].weaponType === 'bow'
    ? 'ranged'
    : 'melee';
}

type EquippedSpellView = {
  slot: 'spell1' | 'spell2';
  spellId: string | null;
};

export function spellForHotkey(
  loadout: readonly EquippedSpellView[],
  slot: EquippedSpellView['slot'],
): string | null {
  return loadout.find((spell) => spell.slot === slot)?.spellId ?? null;
}
