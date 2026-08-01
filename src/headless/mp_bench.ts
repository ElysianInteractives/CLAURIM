// Headless multiplayer combat benchmark (D-018 measurement, not intuition).
// Scripted bot parties fight the Duskhollow boss; we measure time-to-defeat,
// wipes, downs, and incoming pressure at party sizes 1/3/5.
// Run: npm run mp:bench -- runs=5 policy=mechanics|naive|compare

import { Sim, IDLE_INPUT, type PlayerInput } from '../sim/sim';
import { DT } from '../sim/types';
import type { Actor } from '../sim/types';

type BotPolicy = 'naive' | 'mechanics';

interface BotResult {
  policy: BotPolicy;
  partySize: number;
  seed: number;
  outcome: 'boss_dead' | 'wipe_limit' | 'timeout';
  seconds: number;
  wipes: number;
  downs: number;
  revives: number;
  interrupts: number;
  blockedHits: number;
  damageTaken: number;
  bossPhaseReached: number;
  avgPartyHealthFrac: number;
}

function moveToward(x: number, z: number, self: Actor, sprint = false): PlayerInput {
  return {
    ...IDLE_INPUT,
    moveZ: 1,
    yaw: Math.atan2(x - self.pos.x, z - self.pos.z),
    sprint,
  };
}

function escapeGroundAoe(sim: Sim, self: Actor): PlayerInput | null {
  for (const aoe of sim.groundAoes) {
    if (aoe.spaceId !== self.pos.spaceId) continue;
    const distance = Math.hypot(self.pos.x - aoe.x, self.pos.z - aoe.z);
    if (distance < aoe.radius + 0.5) {
      return moveToward(
        self.pos.x + (self.pos.x - aoe.x),
        self.pos.z + (self.pos.z - aoe.z),
        self,
      );
    }
  }
  return null;
}

function reviveInput(sim: Sim, charId: string, self: Actor): PlayerInput | null {
  const downedMate = [...sim.players.values()]
    .map((id) => sim.actors.get(id))
    .find((actor) => actor && actor.downed && actor.pos.spaceId === self.pos.spaceId);
  if (!downedMate) return null;
  const distance = Math.hypot(
    downedMate.pos.x - self.pos.x,
    downedMate.pos.z - self.pos.z,
  );
  if (distance > 2.5) return moveToward(downedMate.pos.x, downedMate.pos.z, self);
  sim.interactFor(charId);
  return {
    ...IDLE_INPUT,
    yaw: Math.atan2(
      downedMate.pos.x - self.pos.x,
      downedMate.pos.z - self.pos.z,
    ),
  };
}

/** Plan 3 baseline policy: stack on the target, swing continuously, consume
 * a low-health draught, revive nearby allies, and leave pools after they land. */
function naiveBotInput(sim: Sim, charId: string, target: Actor | null): PlayerInput {
  const self = sim.playerActor(charId);
  if (!self || self.downed) return { ...IDLE_INPUT };
  const escape = escapeGroundAoe(sim, self);
  if (escape) return escape;
  const revive = reviveInput(sim, charId, self);
  if (revive) return revive;
  if (!target || target.dead) return { ...IDLE_INPUT };
  const dx = target.pos.x - self.pos.x;
  const dz = target.pos.z - self.pos.z;
  const dist = Math.hypot(dx, dz);
  const yaw = Math.atan2(dx, dz);
  // Drink when hurt.
  if (self.health / self.stats.maxHealth < 0.35) {
    sim.useItemFor(charId, 'healing_draught');
  }
  if (dist > 2.0) {
    return moveToward(target.pos.x, target.pos.z, self, dist > 8);
  }
  sim.meleeFor(charId);
  self.stamina = Math.max(self.stamina, 40); // bots pace stamina imperfectly
  return { ...IDLE_INPUT, yaw };
}

/** Mechanics-aware but deliberately fallible policy: pre-moves targeted
 * pools, spreads to assigned boss sectors, blocks late frontal casts, and
 * spends earlier interrupt windows attacking. */
function mechanicsBotInput(
  sim: Sim,
  charId: string,
  boss: Actor | null,
  attackTarget: Actor | null,
  partyIndex: number,
  partySize: number,
): PlayerInput {
  const self = sim.playerActor(charId);
  if (!self || self.downed) return { ...IDLE_INPUT };
  const escape = escapeGroundAoe(sim, self);
  if (escape) return escape;
  if (!boss || boss.dead || !attackTarget || attackTarget.dead) return { ...IDLE_INPUT };

  const abilityId = boss.attack?.abilityId;
  const ability = abilityId
    ? sim.content.actors[boss.templateId]?.abilities?.find(
        (candidate) => candidate.id === abilityId,
      )
    : null;
  const targetedPool =
    ability?.kind === 'ground_aoe' && boss.brain?.targetId === self.id;
  if (targetedPool) {
    const angle = Math.atan2(
      self.pos.x - boss.pos.x,
      self.pos.z - boss.pos.z,
    ) + Math.PI / 2;
    return moveToward(
      self.pos.x + Math.sin(angle) * 5,
      self.pos.z + Math.cos(angle) * 5,
      self,
    );
  }

  if (self.health / self.stats.maxHealth < 0.42) {
    sim.useItemFor(charId, 'healing_draught');
  }

  const bossDistance = Math.hypot(
    boss.pos.x - self.pos.x,
    boss.pos.z - self.pos.z,
  );
  if (
    ability?.kind === 'frontal_cone' &&
    boss.attack?.telegraph &&
    boss.attack.t <= 8 &&
    bossDistance <= (ability.range ?? 8)
  ) {
    return {
      ...IDLE_INPUT,
      yaw: Math.atan2(boss.pos.x - self.pos.x, boss.pos.z - self.pos.z),
      block: true,
    };
  }

  const incomingMelee = [...sim.actors.values()].find(
    (actor) =>
      actor.id === boss.id &&
      actor.brain?.targetId === self.id &&
      actor.attack &&
      actor.attack.phase !== 'recover' &&
      !actor.attack.telegraph &&
      !actor.dead &&
      actor.pos.spaceId === self.pos.spaceId &&
      Math.hypot(actor.pos.x - self.pos.x, actor.pos.z - self.pos.z) <= 3,
  );
  if (incomingMelee) {
    return {
      ...IDLE_INPUT,
      yaw: Math.atan2(
        incomingMelee.pos.x - self.pos.x,
        incomingMelee.pos.z - self.pos.z,
      ),
      block: true,
    };
  }

  if (!boss.attack?.telegraph && self.health / self.stats.maxHealth > 0.45) {
    const revive = reviveInput(sim, charId, self);
    if (revive) return revive;
  }

  const dx = attackTarget.pos.x - self.pos.x;
  const dz = attackTarget.pos.z - self.pos.z;
  const distance = Math.hypot(dx, dz);
  const faceTarget = Math.atan2(dx, dz);
  const sector = (partyIndex / Math.max(1, partySize)) * Math.PI * 2;
  const desired = {
    x: attackTarget.pos.x + Math.sin(sector) * 1.65,
    z: attackTarget.pos.z + Math.cos(sector) * 1.65,
  };
  if (distance > 2.0) {
    return moveToward(desired.x, desired.z, self, distance > 8);
  }

  sim.meleeFor(charId);
  self.stamina = Math.max(self.stamina, 40);
  return { ...IDLE_INPUT, yaw: faceTarget };
}

function runFight(
  policy: BotPolicy,
  partySize: number,
  seed: number,
  maxSeconds = 240,
): BotResult {
  const sim = new Sim(seed);
  const chars: string[] = ['p1'];
  for (let i = 2; i <= partySize; i++) {
    sim.addPlayer(`p${i}`, `Bot${i}`);
    chars.push(`p${i}`);
  }
  if (chars.length > 1) {
    for (const charId of chars) sim.joinParty(charId, 'party:p1');
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
  let blockedHits = 0;
  let damageTaken = 0;
  let phaseReached = 0;
  let healthAccum = 0;
  let healthSamples = 0;
  const maxTicks = maxSeconds / DT;
  let t = 0;
  for (; t < maxTicks; t++) {
    const downedBefore = new Set(
      chars.filter((charId) => sim.playerActor(charId)?.downed),
    );
    const inputs = new Map<string, PlayerInput>();
    chars.forEach((charId, index) => {
      const self = sim.playerActor(charId);
      const nearestSummon = [...sim.actors.values()]
        .filter(
          (actor) =>
            actor.summonedBy === boss.id &&
            !actor.dead &&
            actor.pos.spaceId === self?.pos.spaceId,
        )
        .sort(
          (left, right) =>
            Math.hypot(left.pos.x - self!.pos.x, left.pos.z - self!.pos.z) -
            Math.hypot(right.pos.x - self!.pos.x, right.pos.z - self!.pos.z),
        )[0];
      inputs.set(
        charId,
        policy === 'mechanics'
          ? mechanicsBotInput(
              sim,
              charId,
              boss,
              nearestSummon ?? boss,
              index,
              chars.length,
            )
          : naiveBotInput(sim, charId, boss),
      );
    });
    for (const charId of downedBefore) {
      if (!sim.playerActor(charId)?.downed) revives++;
    }
    sim.tick(inputs);
    for (const e of sim.events) {
      if (e.type === 'playerDowned') downs++;
      if (e.type === 'playerRevived') revives++;
      if (e.type === 'interrupted') interrupts++;
      if (e.type === 'damage' && sim.context().charIdOf(e.targetId)) {
        damageTaken += e.amount;
        if (e.blocked) blockedHits++;
      }
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
  }
  return {
    policy,
    partySize,
    seed,
    outcome: boss.dead ? 'boss_dead' : wipes >= 3 ? 'wipe_limit' : 'timeout',
    seconds: Math.round(t * DT),
    wipes,
    downs,
    revives,
    interrupts,
    blockedHits,
    damageTaken: +damageTaken.toFixed(1),
    bossPhaseReached: phaseReached,
    avgPartyHealthFrac: healthSamples ? +(healthAccum / healthSamples).toFixed(2) : 0,
  };
}

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.split('=')));
const runs = Number(args.runs ?? 3);
const requestedPolicy = args.policy ?? 'mechanics';
if (!['naive', 'mechanics', 'compare'].includes(requestedPolicy)) {
  throw new Error(`unknown policy ${requestedPolicy}; use naive, mechanics, or compare`);
}
const policies: BotPolicy[] =
  requestedPolicy === 'compare'
    ? ['naive', 'mechanics']
    : [requestedPolicy as BotPolicy];

const results: BotResult[] = [];
for (const policy of policies) {
  for (const size of [1, 3, 5]) {
    for (let r = 0; r < runs; r++) {
      results.push(runFight(policy, size, 9000 + r));
    }
  }
}

const summary = policies.flatMap((policy) =>
  [1, 3, 5].map((size) => {
    const rows = results.filter(
      (result) => result.policy === policy && result.partySize === size,
    );
    const kills = rows.filter((result) => result.outcome === 'boss_dead');
    return {
      policy,
      partySize: size,
      runs: rows.length,
      bossKilled: kills.length,
      avgKillSeconds: kills.length
        ? Math.round(kills.reduce((sum, result) => sum + result.seconds, 0) / kills.length)
        : null,
      totalWipes: rows.reduce((sum, result) => sum + result.wipes, 0),
      totalDowns: rows.reduce((sum, result) => sum + result.downs, 0),
      totalRevives: rows.reduce((sum, result) => sum + result.revives, 0),
      totalInterrupts: rows.reduce((sum, result) => sum + result.interrupts, 0),
      totalBlockedHits: rows.reduce((sum, result) => sum + result.blockedHits, 0),
      damageTaken: +rows
        .reduce((sum, result) => sum + result.damageTaken, 0)
        .toFixed(1),
      maxPhase: Math.max(...rows.map((result) => result.bossPhaseReached)),
      avgPartyHealth: +(
        rows.reduce((sum, result) => sum + result.avgPartyHealthFrac, 0) /
        rows.length
      ).toFixed(2),
    };
  }),
);

console.log(JSON.stringify({ requestedPolicy, perRun: results, summary }, null, 2));
