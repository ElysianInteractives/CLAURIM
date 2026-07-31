// Browser-host command selection from authored content. This keeps host input
// dispatch data-driven without exposing a new simulation command.

import { CONTENT } from '../sim/content';

type EquippedItemView = {
  itemId: string;
  kind: string;
  equipped: boolean;
};

export function equippedAttackKind(inventory: readonly EquippedItemView[]): 'melee' | 'ranged' {
  const weapon = inventory.find((item) => item.equipped && item.kind === 'weapon');
  return weapon && CONTENT.items[weapon.itemId]?.kind === 'weapon' && CONTENT.items[weapon.itemId].weaponType === 'bow'
    ? 'ranged'
    : 'melee';
}
