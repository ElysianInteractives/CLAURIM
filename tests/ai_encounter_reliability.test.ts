// Plan 4 AI/encounter contract: perception, target continuity, authored pull
// ownership, support/summon ability use, schedules, return recovery, and
// encounter reset must be deterministic and explainable.

import { describe, expect, it } from 'vitest';
import { executeAbility, startAbility } from '../src/sim/ai/abilities';
import { canPerceive, tickBrain } from '../src/sim/ai/brain';
import { CONTENT } from '../src/sim/content';
import type { ContentRegistry } from '../src/sim/content/schema';
import { IDLE_INPUT, Sim } from '../src/sim/sim';
import { DT, GAME_HOURS_PER_SECOND } from '../src/sim/types';

const SEED = 42;

function actorByTemplate(sim: Sim, templateId: string) {
  const actor = [...sim.actors.values()].find((candidate) => candidate.templateId === templateId);
  if (!actor) throw new Error(`missing actor ${templateId}`);
  return actor;
}

function actorBySpawner(sim: Sim, spawnerId: string) {
  const actor = [...sim.actors.values()].find((candidate) => candidate.spawnerId === spawnerId);
  if (!actor) throw new Error(`missing spawner actor ${spawnerId}`);
  return actor;
}

function face(actor: ReturnType<typeof actorByTemplate>, x: number, z: number): void {
  actor.yaw = Math.atan2(x - actor.pos.x, z - actor.pos.z);
}

describe('Plan 4 perception and target continuity', () => {
  it('does not perceive a target through an implicit interior wall', () => {
    const sim = new Sim(SEED, CONTENT, { skipSpawn: true, noDefaultPlayer: true });
    sim.addPlayer('p1', 'Alva');
    const player = sim.playerActor('p1')!;
    sim.movePlayerTo('p1', 'duskhollow_mine', -8, 28, 0);
    const reaverId = sim.spawnFromTemplate(
      'redclaw_reaver',
      'duskhollow_mine',
      { x: -4, y: 0, z: 4 },
      0,
    );
    const reaver = sim.actors.get(reaverId)!;
    face(reaver, player.pos.x, player.pos.z);

    expect(canPerceive(sim.context(), reaver, player)).toBe(false);
  });

  it('switches to a visible threat when the current threat is hidden', () => {
    const sim = new Sim(SEED, CONTENT, { skipSpawn: true, noDefaultPlayer: true });
    sim.addPlayer('p1', 'Alva');
    sim.addPlayer('p2', 'Brona');
    sim.movePlayerTo('p1', 'duskhollow_mine', -8, 28, 0);
    sim.movePlayerTo('p2', 'duskhollow_mine', -4, 8, 0);
    const reaverId = sim.spawnFromTemplate(
      'redclaw_reaver',
      'duskhollow_mine',
      { x: -4, y: 0, z: 4 },
      0,
    );
    const reaver = sim.actors.get(reaverId)!;
    const hidden = sim.playerActor('p1')!;
    const visible = sim.playerActor('p2')!;
    reaver.brain!.state = 'combat';
    reaver.brain!.targetId = hidden.id;
    reaver.brain!.threat[hidden.id] = 100;
    reaver.brain!.threat[visible.id] = 80;
    reaver.brain!.lastKnownPos = { ...hidden.pos };
    face(reaver, visible.pos.x, visible.pos.z);

    sim.tick(new Map());
    expect(reaver.brain!.targetId).toBe(visible.id);
    expect(reaver.brain!.state).toBe('combat');
  });
});

describe('Plan 4 encounter groups and abilities', () => {
  it('pulls the authored Matron and rat pack as one encounter', () => {
    const sim = new Sim(SEED);
    const player = sim.player();
    const rat = actorBySpawner(sim, 'sp_mine_rats');
    const matron = actorBySpawner(sim, 'sp_mine_matron');
    sim.movePlayerTo('p1', 'duskhollow_mine', 0, 34, 0);

    sim.context().dealDamage(rat.id, player.id, 1, 'physical');
    sim.tick(IDLE_INPUT);

    expect(matron.brain!.state).toBe('combat');
    expect(matron.brain!.targetId).toBe(player.id);
    expect(matron.brain!.scaledFor).toBe(rat.brain!.scaledFor);
  });

  it('does not reset a group while another member retains a valid target', () => {
    const sim = new Sim(SEED);
    const player = sim.player();
    const rat = actorBySpawner(sim, 'sp_mine_rats');
    const matron = actorBySpawner(sim, 'sp_mine_matron');
    sim.movePlayerTo('p1', 'duskhollow_mine', -8, 28, 0);
    rat.pos = { spaceId: 'duskhollow_mine', x: -8, y: 0, z: 30 };
    matron.pos = { spaceId: 'duskhollow_mine', x: -4, y: 0, z: 4 };
    rat.brain!.state = 'combat';
    rat.brain!.targetId = player.id;
    rat.brain!.threat[player.id] = 10;
    rat.brain!.lastKnownPos = { ...player.pos };
    matron.brain!.state = 'search';
    matron.brain!.targetId = player.id;
    matron.brain!.timer = 0;
    matron.brain!.lastKnownPos = null;

    tickBrain(sim.context(), matron.id);

    expect(rat.brain!.state).toBe('combat');
    expect(matron.brain!.state).toBe('search');
    expect(matron.brain!.targetId).toBe(player.id);
    expect(matron.brain!.timer).toBeGreaterThan(0);
  });

  it('casts a support heal only when an allied encounter member is injured', () => {
    const sim = new Sim(SEED);
    const player = sim.player();
    const rat = actorBySpawner(sim, 'sp_mine_rats');
    const matron = actorBySpawner(sim, 'sp_mine_matron');
    sim.movePlayerTo('p1', 'duskhollow_mine', -5, 32, 0);
    rat.health = rat.stats.maxHealth * 0.25;
    const injuredHealth = rat.health;
    sim.context().dealDamage(matron.id, player.id, 1, 'physical');

    let healedRat = false;
    for (let tick = 0; tick < 240 && !healedRat; tick++) {
      sim.tick(IDLE_INPUT);
      healedRat = sim.events.some((event) => event.type === 'heal' && event.targetId === rat.id);
    }
    expect(healedRat).toBe(true);
    expect(rat.health).toBeGreaterThan(injuredHealth);
  });

  it('does not waste a support cooldown when no ally needs healing', () => {
    const sim = new Sim(SEED);
    const player = sim.player();
    const matron = actorBySpawner(sim, 'sp_mine_matron');
    sim.movePlayerTo('p1', 'duskhollow_mine', -5, 32, 0);
    matron.brain!.state = 'combat';
    matron.brain!.targetId = player.id;
    matron.brain!.threat[player.id] = 10;

    sim.tick(IDLE_INPUT);
    expect(matron.attack).toBeNull();
    expect(matron.brain!.abilityCooldowns.brood_mending ?? 0).toBe(0);
  });

  it('ticks an ability cooldown while its telegraph is active', () => {
    const sim = new Sim(SEED);
    const boss = actorByTemplate(sim, 'barrow_wight');
    sim.movePlayerTo('p1', 'duskhollow_mine', 0, 65, 0);
    const player = sim.player();
    boss.brain!.state = 'combat';
    boss.brain!.targetId = player.id;
    boss.brain!.threat[player.id] = 10;
    face(boss, player.pos.x, player.pos.z);
    const ability = CONTENT.actors.barrow_wight.abilities!.find(
      (candidate) => candidate.id === 'pale_breath',
    )!;
    expect(startAbility(sim.context(), boss, ability)).toBe(true);
    expect(boss.brain!.abilityCooldowns.pale_breath).toBe(ability.cooldownTicks);

    sim.tick(IDLE_INPUT);
    expect(boss.brain!.abilityCooldowns.pale_breath).toBe(ability.cooldownTicks - 1);
  });

  it('caps living summons from repeated reinforcement casts', () => {
    const sim = new Sim(SEED);
    const boss = actorByTemplate(sim, 'barrow_wight');
    for (let cast = 0; cast < 3; cast++) {
      executeAbility(sim.context(), boss, 'call_thralls');
    }
    const livingSummons = [...sim.actors.values()].filter(
      (actor) => actor.summonedBy === boss.id && !actor.dead,
    );
    expect(livingSummons).toHaveLength(4);
  });

  it('clears all owned transient mechanics on a boss reset', () => {
    const sim = new Sim(SEED);
    const boss = actorByTemplate(sim, 'barrow_wight');
    sim.movePlayerTo('p1', 'duskhollow_mine', 0, 65, 0);
    const player = sim.player();
    boss.brain!.state = 'combat';
    boss.brain!.targetId = player.id;
    boss.brain!.threat[player.id] = 10;
    boss.brain!.phase = 2;
    boss.brain!.scaledFor = 3;
    boss.brain!.abilityCooldowns.pale_breath = 120;
    boss.health = 1;
    executeAbility(sim.context(), boss, 'call_thralls');
    executeAbility(sim.context(), boss, 'grave_chill');
    const summon = [...sim.actors.values()].find(
      (actor) => actor.summonedBy === boss.id,
    )!;
    sim.projectiles.push({
      id: 999,
      spaceId: boss.pos.spaceId,
      pos: { x: boss.pos.x, y: 1.2, z: boss.pos.z },
      vel: { x: 0, y: 0, z: 1 },
      channel: 'frost',
      damage: 5,
      sourceId: summon.id,
      ttl: 3,
      kind: 'spell',
    });
    expect(sim.groundAoes.length).toBeGreaterThan(0);
    expect(sim.projectiles).toHaveLength(1);
    expect([...sim.actors.values()].some((actor) => actor.summonedBy === boss.id)).toBe(true);

    sim.resetEncounter(boss.id);

    expect([...sim.actors.values()].some((actor) => actor.summonedBy === boss.id)).toBe(false);
    expect(sim.groundAoes).toHaveLength(0);
    expect(sim.projectiles).toHaveLength(0);
    expect(boss.brain!.phase).toBe(0);
    expect(boss.brain!.scaledFor).toBe(0);
    expect(boss.brain!.abilityCooldowns).toEqual({});
    expect(boss.health).toBe(boss.stats.maxHealth);
  });

  it('restores defeated preplaced members when their authored encounter resets', () => {
    const sim = new Sim(SEED);
    const rat = actorBySpawner(sim, 'sp_mine_rats');
    const matron = actorBySpawner(sim, 'sp_mine_matron');
    rat.dead = true;
    rat.health = 0;
    rat.lootRolled = true;
    rat.inventory = [{ itemId: 'raw_rations', count: 1 }];
    rat.brain!.state = 'dead';

    sim.resetEncounter(matron.id);

    expect(rat.dead).toBe(false);
    expect(rat.brain!.state).toBe('idle');
    expect(rat.health).toBe(rat.stats.maxHealth);
    expect(rat.lootRolled).toBe(false);
    expect(rat.inventory).toEqual([]);
  });
});

describe('Plan 4 schedules and return recovery', () => {
  it('advances an offscreen NPC through the door graph to a cross-space schedule', () => {
    const sim = new Sim(SEED);
    const brandvar = actorByTemplate(sim, 'bronn');
    sim.movePlayerTo('p1', 'fenharrow_inn', 0, 6, 0);
    sim.tickCount = Math.round((12 / GAME_HOURS_PER_SECOND) / DT); // 20:00 from the 08:00 epoch

    sim.tick(IDLE_INPUT);

    expect(brandvar.pos.spaceId).toBe('fenharrow_inn');
    expect(Math.hypot(brandvar.pos.x - 3, brandvar.pos.z - 8)).toBeLessThan(0.1);
    expect(brandvar.brain!.homePos.spaceId).toBe('fenharrow_inn');
  });

  it('uses the authored door transition while a scheduled NPC is observed', () => {
    const sim = new Sim(SEED);
    const brandvar = actorByTemplate(sim, 'bronn');
    sim.movePlayerTo('p1', 'kaldwyn', 33, 145, 0);
    brandvar.pos = { spaceId: 'kaldwyn', x: 33, y: 0, z: 146 };
    brandvar.brain!.homePos = { ...brandvar.pos };
    sim.tickCount = Math.round((12 / GAME_HOURS_PER_SECOND) / DT);

    sim.tick(IDLE_INPUT);

    expect(brandvar.pos.spaceId).toBe('fenharrow_inn');
    expect(Math.hypot(brandvar.pos.x, brandvar.pos.z - 1.5)).toBeLessThan(0.1);
  });

  it('recovers a returner whose valid home is in a disconnected room', () => {
    const content: ContentRegistry = {
      ...CONTENT,
      spaces: {
        ...CONTENT.spaces,
        test_islands: {
          id: 'test_islands',
          name: 'Test Islands',
          kind: 'interior',
          interior: {
            ceilingY: 3,
            rooms: [
              { x0: -8, z0: -3, x1: -2, z1: 3 },
              { x0: 2, z0: -3, x1: 8, z1: 3 },
            ],
          },
        },
      },
    };
    const sim = new Sim(SEED, content, { skipSpawn: true, noDefaultPlayer: true });
    sim.addPlayer('p1', 'Alva');
    sim.movePlayerTo('p1', 'test_islands', -5, 0, 0);
    const wolfId = sim.spawnFromTemplate('frostfang_wolf', 'test_islands', { x: -5, y: 0, z: 0 }, 0);
    const wolf = sim.actors.get(wolfId)!;
    wolf.brain!.state = 'return';
    wolf.brain!.homePos = { spaceId: 'test_islands', x: 5, y: 0, z: 0 };

    for (let tick = 0; tick < 180; tick++) sim.tick(IDLE_INPUT);

    expect(wolf.brain!.state).toBe('idle');
    expect(Math.hypot(wolf.pos.x - 5, wolf.pos.z)).toBeLessThan(0.8);
  });
});
