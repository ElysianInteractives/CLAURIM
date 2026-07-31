// Headless multiplayer combat benchmark (D-018 measurement, not intuition).
// Scripted bot parties fight the Duskhollow boss; we measure time-to-defeat,
// wipes, downs, and incoming pressure at party sizes 1/3/5.
// Run: npm run mp:bench [-- runs=5]

import { Sim, IDLE_INPUT, type PlayerInput } from '../sim/sim';
import { DT, INTERRUPT_DAMAGE } from '../sim/types';
import type { Actor } from '../sim/types';

interface BotResult {
  partySize: number;
  seed: number;
  outcome: 'boss_dead' | 'wipe_limit' | 'timeout';
  seconds: number;
  wipes: number;
  downs: number;
  revives: number;
  interrupts: number;
  bossPhaseReached: number;
  avgPartyHealthFrac: number;
}

/** Simple bot: approach the boss, swing when close, drink when hurt, revive
 * downed mates, back out of ground pools. Deliberately imperfect. */
function botInput(sim: Sim, charId: string, target: Actor | null): PlayerInput {
  const self = sim.playerActor(charId);
  if (!self || self.downed) return { ...IDLE_INPUT };
  // Escape pools.
  for (const aoe of sim.groundAoes) {
    if (aoe.spaceId !== self.pos.spaceId) continue;
    const d = Math.hypot(self.pos.x - aoe.x, self.pos.z - aoe.z);
    if (d < aoe.radius + 0.5) {
      const yaw = Math.atan2(self.pos.x - aoe.x, self.pos.z - aoe.z);
      return { ...IDLE_INPUT, moveZ: 1, yaw };
    }
  }
  // Revive a downed mate if adjacent target exists.
  const downedMate = [...sim.players.values()]
    .map((id) => sim.actors.get(id))
    .find((a) => a && a.downed && a.pos.spaceId === self.pos.spaceId);
  if (downedMate) {
    const d = Math.hypot(downedMate.pos.x - self.pos.x, downedMate.pos.z - self.pos.z);
    const yaw = Math.atan2(downedMate.pos.x - self.pos.x, downedMate.pos.z - self.pos.z);
    if (d > 2.5) return { ...IDLE_INPUT, moveZ: 1, yaw };
    sim.interactFor(charId); // revive
    return { ...IDLE_INPUT, yaw };
  }
  if (!target || target.dead) return { ...IDLE_INPUT };
  const dx = target.pos.x - self.pos.x;
  const dz = target.pos.z - self.pos.z;
  const dist = Math.hypot(dx, dz);
  const yaw = Math.atan2(dx, dz);
  // Drink when hurt.
  if (self.health / self.stats.maxHealth < 0.35) {
    sim.useItemFor(charId, 'healing_draught');
  }
  // Interrupt priority: burst the telegraph (bots just keep attacking).
  if (dist > 2.0) {
    return { ...IDLE_INPUT, moveZ: 1, yaw, sprint: dist > 8 };
  }
  sim.meleeFor(charId);
  self.stamina = Math.max(self.stamina, 40); // bots pace stamina imperfectly
  return { ...IDLE_INPUT, yaw };
}

function runFight(partySize: number, seed: number, maxSeconds = 240): BotResult {
  const sim = new Sim(seed);
  const chars: string[] = ['p1'];
  for (let i = 2; i <= partySize; i++) {
    sim.addPlayer(`p${i}`, `Bot${i}`);
    chars.push(`p${i}`);
  }
  // Gear the party: swords + shields + draughts (a prepared, not perfect, group).
  for (const c of chars) {
    const a = sim.playerActor(c)!;
    sim.context().addItem(a.id, 'iron_sword', 1);
    sim.context().addItem(a.id, 'wooden_shield', 1);
    sim.context().addItem(a.id, 'healing_draught', 3);
    sim.equipFor(c, 'iron_sword');
    sim.equipFor(c, 'wooden_shield');
  }
  // Walk in at the vault mouth.
  chars.forEach((c, i) => sim.movePlayerTo(c, 'duskhollow_mine', -2 + i * 1.2, 53, 0));
  const boss = [...sim.actors.values()].find((a) => a.templateId === 'barrow_wight')!;

  let wipes = 0;
  let downs = 0;
  let revives = 0;
  let interrupts = 0;
  let phaseReached = 0;
  let healthAccum = 0;
  let healthSamples = 0;
  const maxTicks = maxSeconds / DT;
  let t = 0;
  for (; t < maxTicks; t++) {
    const inputs = new Map<string, PlayerInput>();
    for (const c of chars) inputs.set(c, botInput(sim, c, boss));
    sim.tick(inputs);
    for (const e of sim.events) {
      if (e.type === 'playerDowned') downs++;
      if (e.type === 'playerRevived') revives++;
      if (e.type === 'interrupted') interrupts++;
      if (e.type === 'bossPhase') phaseReached = Math.max(phaseReached, e.phase);
      if (e.type === 'encounterWipe') wipes++;
    }
    if (t % 30 === 0) {
      for (const c of chars) {
        const a = sim.playerActor(c)!;
        healthAccum += a.downed ? 0 : a.health / a.stats.maxHealth;
        healthSamples++;
      }
    }
    if (boss.dead) break;
    if (wipes >= 3) break;
    // After a wipe the bots walk back in from the release point.
    void INTERRUPT_DAMAGE;
  }
  return {
    partySize,
    seed,
    outcome: boss.dead ? 'boss_dead' : wipes >= 3 ? 'wipe_limit' : 'timeout',
    seconds: Math.round(t * DT),
    wipes,
    downs,
    revives,
    interrupts,
    bossPhaseReached: phaseReached,
    avgPartyHealthFrac: healthSamples ? +(healthAccum / healthSamples).toFixed(2) : 0,
  };
}

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.split('=')));
const runs = Number(args.runs ?? 3);

const results: BotResult[] = [];
for (const size of [1, 3, 5]) {
  for (let r = 0; r < runs; r++) {
    results.push(runFight(size, 9000 + r));
  }
}

const summary = [1, 3, 5].map((size) => {
  const rows = results.filter((r) => r.partySize === size);
  const kills = rows.filter((r) => r.outcome === 'boss_dead');
  return {
    partySize: size,
    runs: rows.length,
    bossKilled: kills.length,
    avgKillSeconds: kills.length ? Math.round(kills.reduce((s, r) => s + r.seconds, 0) / kills.length) : null,
    totalWipes: rows.reduce((s, r) => s + r.wipes, 0),
    totalDowns: rows.reduce((s, r) => s + r.downs, 0),
    totalRevives: rows.reduce((s, r) => s + r.revives, 0),
    totalInterrupts: rows.reduce((s, r) => s + r.interrupts, 0),
    maxPhase: Math.max(...rows.map((r) => r.bossPhaseReached)),
    avgPartyHealth: +(rows.reduce((s, r) => s + r.avgPartyHealthFrac, 0) / rows.length).toFixed(2),
  };
});

console.log(JSON.stringify({ perRun: results, summary }, null, 2));
