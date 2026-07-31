// Actor creation + the ONE place derived stats are recomputed
// (recalcActorStats): base template stats + equipment mods + perk mods +
// active effect mods, composed by effects/modifiers.deriveStats.

import type { Actor, ActorKind, ContentId, EntityId, Position, SkillId, Stats } from '../types';
import { SKILL_IDS, BASE_WALK_SPEED, SCALE_DMG_PER_PLAYER, SCALE_HP_PER_PLAYER } from '../types';
import type { ContentRegistry } from '../content/schema';
import { deriveStats, type StatModifier } from '../effects/modifiers';

export function defaultBaseStats(): Stats {
  return {
    maxHealth: 100,
    maxStamina: 100,
    maxMagicka: 100,
    healthRegen: 0.5,
    staminaRegen: 10,
    magickaRegen: 3,
    moveSpeed: BASE_WALK_SPEED,
    meleeDamage: 3,
    rangedDamage: 0,
    spellPower: 1,
    armor: 0,
    blockMitigation: 0.3,
    stealth: 1,
    detection: 1,
    carryWeight: 220,
    resistPhysical: 0,
    resistFire: 0,
    resistFrost: 0,
    resistShock: 0,
    resistPoison: 0,
  };
}

function emptySkills(): Record<SkillId, { level: number; xp: number }> {
  const skills = {} as Record<SkillId, { level: number; xp: number }>;
  for (const id of SKILL_IDS) skills[id] = { level: 1, xp: 0 };
  return skills;
}

export function createActor(
  id: EntityId,
  kind: ActorKind,
  templateId: ContentId,
  name: string,
  pos: Position,
): Actor {
  const base = defaultBaseStats();
  return {
    id,
    kind,
    templateId,
    name,
    pos,
    yaw: 0,
    vel: { x: 0, y: 0, z: 0 },
    health: base.maxHealth,
    stamina: base.maxStamina,
    magicka: base.maxMagicka,
    stats: base,
    dead: false,
    sneaking: false,
    blocking: false,
    sprinting: false,
    attack: null,
    effects: [],
    inventory: [],
    equipment: {},
    gold: 0,
    skills: emptySkills(),
    perks: [],
    level: 1,
    characterXp: 0,
    perkPoints: 0,
    brain: null,
    factionId: null,
    downed: false,
    downedTicks: 0,
    summonedBy: 0,
    spawnerId: null,
    lootRolled: false,
    moveIntent: { x: 0, z: 0 },
    interactCooldown: 0,
  };
}

/** Base stats for an actor: player uses defaults + level growth; templates
 * override selectively. */
export function baseStatsFor(content: ContentRegistry, a: Actor): Stats {
  const base = defaultBaseStats();
  if (a.kind !== 'player') {
    const tpl = content.actors[a.templateId];
    if (tpl) {
      Object.assign(base, tpl.baseStats);
      base.meleeDamage = tpl.attackDamage;
      base.rangedDamage = tpl.attackDamage;
      if (tpl.moveSpeed !== undefined) base.moveSpeed = tpl.moveSpeed;
    }
  } else {
    // Modest level growth; most player power comes from skills/perks/equipment.
    base.maxHealth += (a.level - 1) * 8;
    base.maxStamina += (a.level - 1) * 4;
    base.maxMagicka += (a.level - 1) * 4;
  }
  return base;
}

/** Collect every modifier that currently applies to the actor. */
export function collectModifiers(content: ContentRegistry, a: Actor): StatModifier[] {
  const mods: StatModifier[] = [];
  // Equipment: armor totals + explicit equipMods.
  for (const itemId of Object.values(a.equipment)) {
    if (!itemId) continue;
    const item = content.items[itemId];
    if (!item) continue;
    if (item.armor) mods.push({ stat: 'armor', op: 'add', value: item.armor, source: `item:${item.id}` });
    if (item.kind === 'weapon' && item.damage) {
      if (item.weaponType === 'bow') {
        mods.push({ stat: 'rangedDamage', op: 'add', value: item.damage, source: `item:${item.id}` });
      } else {
        mods.push({ stat: 'meleeDamage', op: 'add', value: item.damage, source: `item:${item.id}` });
      }
    }
    for (const m of item.equipMods ?? []) mods.push(m);
  }
  // Perks.
  for (const perkId of a.perks) {
    const perk = content.perks[perkId];
    if (perk) mods.push(...perk.mods);
  }
  // Skill passives: each skill level adds small scaling to its governed area.
  const sk = a.skills;
  mods.push(
    { stat: 'meleeDamage', op: 'mul', value: 1 + (sk.oneHanded.level - 1) * 0.03, source: 'skill:oneHanded' },
    { stat: 'rangedDamage', op: 'mul', value: 1 + (sk.archery.level - 1) * 0.03, source: 'skill:archery' },
    { stat: 'spellPower', op: 'mul', value: 1 + (sk.destruction.level - 1) * 0.04, source: 'skill:destruction' },
    { stat: 'stealth', op: 'mul', value: 1 + (sk.sneak.level - 1) * 0.05, source: 'skill:sneak' },
    { stat: 'blockMitigation', op: 'add', value: (sk.block.level - 1) * 0.01, source: 'skill:block' },
  );
  // Encounter scaling (D-018): locked at first aggro to the engaged party
  // size; expressed through the one modifier system like everything else.
  if (a.brain && a.brain.scaledFor > 1) {
    const extra = a.brain.scaledFor - 1;
    mods.push(
      { stat: 'maxHealth', op: 'mul', value: 1 + SCALE_HP_PER_PLAYER * extra, source: `scale:party${a.brain.scaledFor}` },
      { stat: 'meleeDamage', op: 'mul', value: 1 + SCALE_DMG_PER_PLAYER * extra, source: `scale:party${a.brain.scaledFor}` },
      { stat: 'rangedDamage', op: 'mul', value: 1 + SCALE_DMG_PER_PLAYER * extra, source: `scale:party${a.brain.scaledFor}` },
    );
  }
  // Active effects.
  for (const ef of a.effects) {
    const def = content.effects[ef.effectId];
    if (!def) continue;
    for (const m of def.mods) {
      for (let s = 0; s < ef.stacks; s++) mods.push(m);
    }
  }
  return mods;
}

/** Recompute derived stats; clamps current resources to new maxima. */
export function recalcActorStats(content: ContentRegistry, a: Actor): void {
  const base = baseStatsFor(content, a);
  a.stats = deriveStats(base, collectModifiers(content, a));
  if (a.health > a.stats.maxHealth) a.health = a.stats.maxHealth;
  if (a.stamina > a.stats.maxStamina) a.stamina = a.stats.maxStamina;
  if (a.magicka > a.stats.maxMagicka) a.magicka = a.stats.maxMagicka;
}
