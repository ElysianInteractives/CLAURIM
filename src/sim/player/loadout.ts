import {
  SPELL_EQUIP_SLOTS,
  type ContentId,
  type SpellEquipSlot,
} from '../types';

export type SpellLoadout = Partial<Record<SpellEquipSlot, ContentId>>;

const PREFERRED_STARTER_SPELLS: readonly ContentId[] = ['flamebolt', 'mend_wounds'];

/** Deterministic loadout used only when creating or migrating a character. */
export function defaultSpellLoadout(knownSpells: readonly ContentId[]): SpellLoadout {
  const ordered = [
    ...PREFERRED_STARTER_SPELLS.filter((spellId) => knownSpells.includes(spellId)),
    ...knownSpells.filter((spellId) => !PREFERRED_STARTER_SPELLS.includes(spellId)),
  ];
  const loadout: SpellLoadout = {};
  for (let index = 0; index < SPELL_EQUIP_SLOTS.length && index < ordered.length; index++) {
    loadout[SPELL_EQUIP_SLOTS[index]] = ordered[index];
  }
  return loadout;
}

/** Rejects stale or duplicated saved assignments without filling intentional gaps. */
export function sanitizeSpellLoadout(
  knownSpells: readonly ContentId[],
  raw: SpellLoadout,
  isSpell: (spellId: ContentId) => boolean,
): SpellLoadout {
  const clean: SpellLoadout = {};
  const assigned = new Set<ContentId>();
  for (const slot of SPELL_EQUIP_SLOTS) {
    const spellId = raw[slot];
    if (!spellId || assigned.has(spellId) || !knownSpells.includes(spellId) || !isSpell(spellId)) continue;
    clean[slot] = spellId;
    assigned.add(spellId);
  }
  return clean;
}

/** Assign one spell exactly once, moving it out of any previous hotkey slot. */
export function assignSpell(
  current: SpellLoadout,
  slot: SpellEquipSlot,
  spellId: ContentId,
): SpellLoadout {
  const next: SpellLoadout = { ...current };
  for (const candidate of SPELL_EQUIP_SLOTS) {
    if (next[candidate] === spellId) delete next[candidate];
  }
  next[slot] = spellId;
  return next;
}
