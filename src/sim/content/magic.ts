// Effects, spells, and perks. One exemplar per mechanical shape:
// instant restore, DoT, stat buff/debuff, projectile spell, self heal spell,
// flat perk, prerequisite perk.

import type { EffectDef, PerkDef, SpellDef } from './schema';

export const EFFECTS: Record<string, EffectDef> = {
  restore_health: {
    id: 'restore_health',
    name: 'Restore Health',
    duration: 3,
    stackRule: 'refresh',
    maxStacks: 1,
    mods: [],
    hot: { perSecond: 12 },
  },
  restore_health_small: {
    id: 'restore_health_small',
    name: 'Nourished',
    duration: 4,
    stackRule: 'refresh',
    maxStacks: 1,
    mods: [],
    hot: { perSecond: 2 },
  },
  restore_stamina: {
    id: 'restore_stamina',
    name: 'Restore Stamina',
    duration: 3,
    stackRule: 'refresh',
    maxStacks: 1,
    mods: [{ stat: 'staminaRegen', op: 'add', value: 15, source: 'effect:restore_stamina' }],
  },
  burning: {
    id: 'burning',
    name: 'Burning',
    duration: 4,
    stackRule: 'refresh',
    maxStacks: 1,
    mods: [],
    dot: { channel: 'fire', perSecond: 3 },
  },
  chilled: {
    id: 'chilled',
    name: 'Chilled',
    duration: 5,
    stackRule: 'refresh',
    maxStacks: 1,
    mods: [{ stat: 'moveSpeed', op: 'mul', value: 0.7, source: 'effect:chilled' }],
  },
  regeneration: {
    id: 'regeneration',
    name: 'Regeneration',
    duration: 10,
    stackRule: 'refresh',
    maxStacks: 1,
    mods: [],
    hot: { perSecond: 4 },
  },
};

export const SPELLS: Record<string, SpellDef> = {
  flamebolt: {
    id: 'flamebolt',
    name: 'Flamebolt',
    kind: 'projectile',
    magickaCost: 14,
    damage: 10,
    channel: 'fire',
    applyEffects: ['burning'],
    skill: 'destruction',
  },
  frostspike: {
    id: 'frostspike',
    name: 'Frostspike',
    kind: 'projectile',
    magickaCost: 16,
    damage: 8,
    channel: 'frost',
    applyEffects: ['chilled'],
    skill: 'destruction',
  },
  mend_wounds: {
    id: 'mend_wounds',
    name: 'Mend Wounds',
    kind: 'self',
    magickaCost: 12,
    heal: 18,
    applyEffects: ['regeneration'],
    skill: 'restoration',
  },
};

export const PERKS: Record<string, PerkDef> = {
  bladesman: {
    id: 'bladesman',
    name: 'Bladesman',
    description: 'One-handed weapons deal 20% more damage.',
    skill: 'oneHanded',
    requiredSkillLevel: 2,
    mods: [{ stat: 'meleeDamage', op: 'mul', value: 1.2, source: 'perk:bladesman' }],
  },
  bladesman_2: {
    id: 'bladesman_2',
    name: 'Bladesman II',
    description: 'One-handed weapons deal a further 20% more damage.',
    skill: 'oneHanded',
    requiredSkillLevel: 5,
    requiresPerk: 'bladesman',
    mods: [{ stat: 'meleeDamage', op: 'mul', value: 1.2, source: 'perk:bladesman_2' }],
  },
  eagle_eye: {
    id: 'eagle_eye',
    name: 'Eagle Eye',
    description: 'Bows deal 20% more damage.',
    skill: 'archery',
    requiredSkillLevel: 2,
    mods: [{ stat: 'rangedDamage', op: 'mul', value: 1.2, source: 'perk:eagle_eye' }],
  },
  shadowfoot: {
    id: 'shadowfoot',
    name: 'Shadowfoot',
    description: 'You are 30% harder to detect while sneaking.',
    skill: 'sneak',
    requiredSkillLevel: 2,
    mods: [{ stat: 'stealth', op: 'mul', value: 1.3, source: 'perk:shadowfoot' }],
  },
  stalwart: {
    id: 'stalwart',
    name: 'Stalwart',
    description: 'Blocking mitigates an additional 10% of damage.',
    skill: 'block',
    requiredSkillLevel: 2,
    mods: [{ stat: 'blockMitigation', op: 'add', value: 0.1, source: 'perk:stalwart' }],
  },
};
