// Deterministic sustained-output benchmark for the Plan 2 combat contract.
// This is a comparison harness, not a balance oracle: same target, duration,
// seed, input cadence, mitigation, and natural resource regeneration.

import { Sim, IDLE_INPUT } from '../sim/sim';
import { ATTACK_STAMINA_COST } from '../sim/types';

type Scenario = {
  id: string;
  kind: 'melee' | 'ranged' | 'spell';
  itemId?: 'worn_dagger' | 'iron_sword' | 'steel_sword' | 'hunting_bow';
};

const SCENARIOS: Scenario[] = [
  { id: 'worn_dagger', kind: 'melee', itemId: 'worn_dagger' },
  { id: 'iron_sword', kind: 'melee', itemId: 'iron_sword' },
  { id: 'steel_sword', kind: 'melee', itemId: 'steel_sword' },
  { id: 'hunting_bow', kind: 'ranged', itemId: 'hunting_bow' },
  { id: 'flamebolt', kind: 'spell' },
];

function runScenario(scenario: Scenario, seconds: number, seed: number) {
  const sim = new Sim(seed);
  const player = sim.player();
  const target = [...sim.actors.values()].find((actor) => actor.templateId === 'barrow_wight')!;
  for (const [id] of [...sim.actors]) {
    if (id !== player.id && id !== target.id) sim.actors.delete(id);
  }
  player.pos = { spaceId: 'duskhollow_mine', x: 0, y: 0, z: 54 };
  player.yaw = 0;
  target.pos = {
    spaceId: 'duskhollow_mine',
    x: 0,
    y: 0,
    z: scenario.kind === 'melee' ? 55.5 : 64,
  };
  target.brain = null;

  if (scenario.itemId && scenario.itemId !== 'worn_dagger') {
    sim.context().addItem(player.id, scenario.itemId, 1);
  }
  if (scenario.itemId) sim.equipFor('p1', scenario.itemId);
  if (scenario.kind === 'ranged') sim.context().addItem(player.id, 'arrow', seconds * 10);

  let totalDamage = 0;
  let hits = 0;
  let rejections = 0;
  let resourceWaitTicks = 0;
  const ticks = seconds * 30;
  for (let tick = 0; tick < ticks; tick++) {
    const canBuffer = player.attack?.phase === 'active' || player.attack?.phase === 'recover';
    const canAfford =
      scenario.kind === 'melee'
        ? player.stamina >= ATTACK_STAMINA_COST
        : scenario.kind === 'spell'
          ? player.magicka >= sim.content.spells.flamebolt.magickaCost
          : sim.context().countItem(player.id, 'arrow') > 0;
    if (canAfford && (!player.attack || (canBuffer && !player.attack.queued))) {
      if (scenario.kind === 'melee') sim.playerMelee();
      else if (scenario.kind === 'ranged') sim.playerRanged();
      else sim.playerCast('flamebolt');
    } else if (!player.attack && !canAfford) {
      resourceWaitTicks++;
    }
    sim.tick(IDLE_INPUT);
    for (const event of sim.events) {
      if (event.type === 'damage' && event.sourceId === player.id && event.targetId === target.id) {
        totalDamage += event.amount;
        hits++;
      } else if (event.type === 'actionRejected' && event.actorId === player.id) {
        rejections++;
      }
    }
    sim.events = [];
    target.health = target.stats.maxHealth;
    target.dead = false;
  }

  return {
    id: scenario.id,
    kind: scenario.kind,
    seconds,
    hits,
    damage: Number(totalDamage.toFixed(1)),
    dps: Number((totalDamage / seconds).toFixed(2)),
    staminaEnd: Number(player.stamina.toFixed(1)),
    magickaEnd: Number(player.magicka.toFixed(1)),
    resourceWaitSeconds: Number((resourceWaitTicks / 30).toFixed(1)),
    rejections,
  };
}

export function runCombatBench(seconds = 30, seed = 20260731) {
  return SCENARIOS.map((scenario, index) => runScenario(scenario, seconds, seed + index));
}

const secondsArg = process.argv.find((arg) => arg.startsWith('seconds='));
const seconds = secondsArg ? Math.max(5, Number(secondsArg.split('=')[1])) : 30;
console.log(JSON.stringify({ seconds, scenarios: runCombatBench(seconds) }, null, 2));
