// Item catalog. Exemplars for every item kind; Opus expands via OPUS_BACKLOG
// tickets following these templates. All records validated by schema.ts.

import type { ItemDef } from './schema';

export const ITEMS: Record<string, ItemDef> = {
  // --- weapons (exemplars: sword, dagger, bow) -----------------------------
  iron_sword: {
    id: 'iron_sword',
    name: 'Iron Sword',
    kind: 'weapon',
    weaponType: 'sword',
    damage: 8,
    damageChannel: 'physical',
    skill: 'oneHanded',
    weight: 9,
    value: 25,
  },
  worn_dagger: {
    id: 'worn_dagger',
    name: 'Worn Dagger',
    kind: 'weapon',
    weaponType: 'dagger',
    damage: 4,
    damageChannel: 'physical',
    skill: 'oneHanded',
    weight: 2,
    value: 8,
  },
  hunting_bow: {
    id: 'hunting_bow',
    name: 'Hunting Bow',
    kind: 'weapon',
    weaponType: 'bow',
    damage: 7,
    damageChannel: 'physical',
    skill: 'archery',
    weight: 5,
    value: 30,
  },
  steel_sword: {
    id: 'steel_sword',
    name: 'Steel Sword',
    kind: 'weapon',
    weaponType: 'sword',
    damage: 11,
    damageChannel: 'physical',
    skill: 'oneHanded',
    weight: 10,
    value: 60,
  },

  // --- ammo / misc ---------------------------------------------------------
  arrow: {
    id: 'arrow',
    name: 'Arrow',
    kind: 'misc',
    stackable: true,
    weight: 0,
    value: 1,
  },

  // --- armor (exemplars: body, head, feet, shield-as-offHand) --------------
  leather_cuirass: {
    id: 'leather_cuirass',
    name: 'Leather Cuirass',
    kind: 'armor',
    slot: 'body',
    armor: 12,
    skill: 'lightArmor',
    weight: 6,
    value: 35,
  },
  leather_helmet: {
    id: 'leather_helmet',
    name: 'Leather Helmet',
    kind: 'armor',
    slot: 'head',
    armor: 5,
    skill: 'lightArmor',
    weight: 2,
    value: 15,
  },
  leather_boots: {
    id: 'leather_boots',
    name: 'Leather Boots',
    kind: 'armor',
    slot: 'feet',
    armor: 4,
    skill: 'lightArmor',
    weight: 2,
    value: 12,
  },
  wooden_shield: {
    id: 'wooden_shield',
    name: 'Wooden Shield',
    kind: 'armor',
    slot: 'offHand',
    armor: 6,
    skill: 'block',
    equipMods: [{ stat: 'blockMitigation', op: 'add', value: 0.15, source: 'item:wooden_shield' }],
    weight: 5,
    value: 20,
  },

  // --- consumables ---------------------------------------------------------
  healing_draught: {
    id: 'healing_draught',
    name: 'Healing Draught',
    kind: 'consumable',
    useEffects: ['restore_health'],
    stackable: true,
    weight: 0.5,
    value: 18,
  },
  stamina_tonic: {
    id: 'stamina_tonic',
    name: 'Stamina Tonic',
    kind: 'consumable',
    useEffects: ['restore_stamina'],
    stackable: true,
    weight: 0.5,
    value: 14,
  },

  // --- ingredients (alchemy exemplars) -------------------------------------
  frost_moss: {
    id: 'frost_moss',
    name: 'Frost Moss',
    kind: 'ingredient',
    stackable: true,
    weight: 0.1,
    value: 3,
  },
  ember_cap: {
    id: 'ember_cap',
    name: 'Ember Cap',
    kind: 'ingredient',
    stackable: true,
    weight: 0.1,
    value: 4,
  },

  // --- quest items ---------------------------------------------------------
  prospectors_journal: {
    id: 'prospectors_journal',
    name: "Hadrin's Journal",
    kind: 'quest',
    weight: 0.2,
    value: 0,
  },
  duskhollow_ore: {
    id: 'duskhollow_ore',
    name: 'Pale Ore Sample',
    kind: 'quest',
    stackable: true,
    weight: 1,
    value: 0,
  },

  // --- misc / economy ------------------------------------------------------
  wolf_pelt: {
    id: 'wolf_pelt',
    name: 'Wolf Pelt',
    kind: 'misc',
    stackable: true,
    weight: 1.5,
    value: 10,
  },
  bread: {
    id: 'bread',
    name: 'Hearth Bread',
    kind: 'consumable',
    useEffects: ['restore_health_small'],
    stackable: true,
    weight: 0.3,
    value: 3,
  },
};
