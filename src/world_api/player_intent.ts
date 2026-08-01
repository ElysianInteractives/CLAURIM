// Intent facet: everything a host may submit on the player's behalf.
// The renderer/UI observe and submit intent; they never resolve outcomes.

import type { ContentId, EntityId, EquipSlot, SpellEquipSlot } from '../sim/types';

export interface PlayerIntentFacet {
  /** Called once per fixed tick by the host loop. */
  step(input: {
    moveX: number;
    moveZ: number;
    yaw: number;
    pitch: number;
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
  unequipItem(slot: EquipSlot): boolean;
  equipSpell(slot: SpellEquipSlot, spellId: ContentId): boolean;
  unequipSpell(slot: SpellEquipSlot): boolean;
  takePerk(perkId: ContentId): boolean;
  respawn(): void;
  /** Request a cooldown-protected return to the space recovery point. */
  recover(): boolean;
  saveGame(): string;
  /** Minimal social presence: a short chat line broadcast to nearby players. */
  chat(text: string): void;
  partyInvite(targetEntityId: EntityId): void;
  partyAccept(): void;
  partyDecline(): void;
  partyLeave(): void;
}
