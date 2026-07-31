// Intent facet: everything a host may submit on the player's behalf.
// The renderer/UI observe and submit intent; they never resolve outcomes.

import type { ContentId } from '../sim/types';

export interface PlayerIntentFacet {
  /** Called once per fixed tick by the host loop. */
  step(input: {
    moveX: number;
    moveZ: number;
    yaw: number;
    sprint: boolean;
    sneak: boolean;
    block: boolean;
    jump: boolean;
  }): void;
  attackMelee(): boolean;
  attackRanged(): boolean;
  castSpell(spellId: ContentId): boolean;
  interact(): 'none' | 'door' | 'container' | 'dialogue' | 'loot';
  useItem(itemId: ContentId): boolean;
  equipItem(itemId: ContentId): boolean;
  takePerk(perkId: ContentId): boolean;
  respawn(): void;
  saveGame(): string;
}
