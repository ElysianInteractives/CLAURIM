// Use-based skill advancement + character leveling + perk acquisition.
// Skill xp -> skill levels; each skill-up feeds character xp; character
// level-ups grant perk points; perks gate on skill level + prerequisite.

import type { EntityId, SkillId } from '../types';
import { skillXpForLevel, xpForLevel } from '../types';
import type { SimContext } from '../sim_context';

export const SKILL_LEVEL_CAP = 25;
export const CHARACTER_XP_PER_SKILL_UP = 30;

export function trainSkill(ctx: SimContext, actorId: EntityId, skill: SkillId, xp: number): void {
  const a = ctx.actors.get(actorId);
  if (!a || a.kind !== 'player' || xp <= 0) return;
  const st = a.skills[skill];
  if (st.level >= SKILL_LEVEL_CAP) return;
  st.xp += xp;
  let leveled = false;
  while (st.level < SKILL_LEVEL_CAP && st.xp >= skillXpForLevel(st.level)) {
    st.xp -= skillXpForLevel(st.level);
    st.level += 1;
    leveled = true;
    ctx.emit({ type: 'skillUp', playerId: actorId, skill, level: st.level });
    grantCharacterXp(ctx, actorId, CHARACTER_XP_PER_SKILL_UP);
  }
  if (leveled) ctx.recalcStats(actorId);
}

export function grantCharacterXp(ctx: SimContext, actorId: EntityId, xp: number): void {
  const a = ctx.actors.get(actorId);
  if (!a || a.kind !== 'player' || xp <= 0) return;
  a.characterXp += xp;
  while (a.characterXp >= xpForLevel(a.level)) {
    a.characterXp -= xpForLevel(a.level);
    a.level += 1;
    a.perkPoints += 1;
    ctx.emit({ type: 'levelUp', playerId: actorId, level: a.level });
    ctx.recalcStats(actorId);
    // Level-up refills resources (rest moment).
    a.health = a.stats.maxHealth;
    a.stamina = a.stats.maxStamina;
    a.magicka = a.stats.maxMagicka;
  }
}

export function canTakePerk(ctx: SimContext, actorId: EntityId, perkId: string): { ok: boolean; reason: string } {
  const a = ctx.actors.get(actorId);
  const perk = ctx.content.perks[perkId];
  if (!a || !perk) return { ok: false, reason: 'unknown perk' };
  if (a.perks.includes(perkId)) return { ok: false, reason: 'already taken' };
  if (a.perkPoints < 1) return { ok: false, reason: 'no perk points' };
  if (a.skills[perk.skill].level < perk.requiredSkillLevel)
    return { ok: false, reason: `requires ${perk.skill} ${perk.requiredSkillLevel}` };
  if (perk.requiresPerk && !a.perks.includes(perk.requiresPerk))
    return { ok: false, reason: `requires perk ${perk.requiresPerk}` };
  return { ok: true, reason: '' };
}

export function takePerk(ctx: SimContext, actorId: EntityId, perkId: string): boolean {
  if (!canTakePerk(ctx, actorId, perkId).ok) return false;
  const a = ctx.actors.get(actorId)!;
  a.perkPoints -= 1;
  a.perks.push(perkId);
  ctx.recalcStats(actorId);
  return true;
}
