// The one coherent modifier/effect composition system (LOCKED D-008).
// Perks, equipment, active spell effects, potions, and difficulty all express
// themselves as StatModifier lists; deriveStats applies them in a fixed order:
//   base -> sum(add) -> product(mul) -> clamp(floors)
// No other code path may patch derived stats directly.

import type { Stats, StatKey } from '../types';

export interface StatModifier {
  stat: StatKey;
  op: 'add' | 'mul';
  value: number;
  /** Attribution for UI explanation and debug tracing ("perk:juggernaut"). */
  source: string;
}

export const STAT_KEYS: readonly StatKey[] = [
  'maxHealth',
  'maxStamina',
  'maxMagicka',
  'healthRegen',
  'staminaRegen',
  'magickaRegen',
  'moveSpeed',
  'meleeDamage',
  'rangedDamage',
  'spellPower',
  'armor',
  'blockMitigation',
  'stealth',
  'detection',
  'carryWeight',
  'resistPhysical',
  'resistFire',
  'resistFrost',
  'resistShock',
  'resistPoison',
];

/** Floors applied after composition. Resists additionally cap at 0.85. */
const FLOORS: Partial<Record<StatKey, number>> = {
  maxHealth: 1,
  maxStamina: 0,
  maxMagicka: 0,
  moveSpeed: 0.5,
  meleeDamage: 0,
  rangedDamage: 0,
  spellPower: 0,
  armor: 0,
  blockMitigation: 0,
  stealth: 0,
  detection: 0.1,
  carryWeight: 10,
};

const RESIST_KEYS: readonly StatKey[] = [
  'resistPhysical',
  'resistFire',
  'resistFrost',
  'resistShock',
  'resistPoison',
];

export const RESIST_CAP = 0.85;

/** Deterministic composition: adds sum, muls multiply, then clamp. */
export function deriveStats(base: Stats, mods: readonly StatModifier[]): Stats {
  const out: Stats = { ...base };
  for (const m of mods) {
    if (m.op === 'add') out[m.stat] += m.value;
  }
  for (const m of mods) {
    if (m.op === 'mul') out[m.stat] *= m.value;
  }
  for (const key of STAT_KEYS) {
    const floor = FLOORS[key];
    if (floor !== undefined && out[key] < floor) out[key] = floor;
  }
  for (const key of RESIST_KEYS) {
    if (out[key] > RESIST_CAP) out[key] = RESIST_CAP;
    if (out[key] < -1) out[key] = -1;
  }
  return out;
}

/** Human-readable trace of how a stat was computed (debug/UI explanation). */
export function explainStat(
  base: Stats,
  mods: readonly StatModifier[],
  stat: StatKey,
): { base: number; steps: { source: string; op: string; value: number }[]; final: number } {
  const steps: { source: string; op: string; value: number }[] = [];
  for (const m of mods) {
    if (m.stat === stat) steps.push({ source: m.source, op: m.op, value: m.value });
  }
  return { base: base[stat], steps, final: deriveStats(base, mods)[stat] };
}
