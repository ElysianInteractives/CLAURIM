import { describe, expect, it } from 'vitest';
import { Sim, type PlayerInput } from '../src/sim/sim';
import { SimWorld } from '../src/game/sim_world';
import { startAbility } from '../src/sim/ai/abilities';
import { startRanged } from '../src/sim/combat/combat';
import {
  ATTACK_STAMINA_COST,
  BLOCK_STAMINA_ON_HIT,
  MELEE_ACTIVE_TICKS,
  MELEE_RECOVER_TICKS,
  MELEE_WINDUP_TICKS,
  RANGED_WINDUP_TICKS,
} from '../src/sim/types';

const idle: PlayerInput = {
  moveX: 0,
  moveZ: 0,
  yaw: 0,
  sprint: false,
  sneak: false,
  block: false,
  jump: false,
};

function closeWolf(sim: Sim) {
  const player = sim.player();
  const wolf = [...sim.actors.values()].find((actor) => actor.templateId === 'frostfang_wolf')!;
  wolf.pos = { ...player.pos, x: player.pos.x, z: player.pos.z + 1.5 };
  wolf.brain = null;
  player.yaw = 0;
  return { player, wolf };
}

describe('Plan 2 combat timing and cancellation', () => {
  it('uses the documented windup, active, and recovery timings', () => {
    const sim = new Sim(42);
    const { player, wolf } = closeWolf(sim);
    const healthBefore = wolf.health;

    expect(sim.playerMelee()).toBe(true);
    expect(player.stamina).toBe(player.stats.maxStamina - ATTACK_STAMINA_COST);
    expect(player.attack).toMatchObject({ phase: 'windup', t: MELEE_WINDUP_TICKS });

    for (let tick = 1; tick < MELEE_WINDUP_TICKS; tick++) {
      sim.tick(idle);
      expect(player.attack?.phase).toBe('windup');
      expect(wolf.health).toBe(healthBefore);
    }
    sim.tick(idle);
    expect(player.attack).toMatchObject({ phase: 'active', t: MELEE_ACTIVE_TICKS });
    expect(wolf.health).toBeLessThan(healthBefore);

    for (let tick = 0; tick < MELEE_ACTIVE_TICKS; tick++) sim.tick(idle);
    expect(player.attack).toMatchObject({ phase: 'recover', t: MELEE_RECOVER_TICKS });
    for (let tick = 0; tick < MELEE_RECOVER_TICKS; tick++) sim.tick(idle);
    expect(player.attack).toBeNull();
  });

  it('buffers one follow-up attack during active/recovery and starts it after recovery', () => {
    const sim = new Sim(42);
    const { player } = closeWolf(sim);
    player.stamina = player.stats.maxStamina;

    expect(sim.playerMelee()).toBe(true);
    for (let tick = 0; tick < MELEE_WINDUP_TICKS; tick++) sim.tick(idle);
    expect(player.attack?.phase).toBe('active');
    expect(sim.playerMelee()).toBe(true);
    expect(player.attack?.queued?.kind).toBe('melee');

    for (let tick = 0; tick < MELEE_ACTIVE_TICKS + MELEE_RECOVER_TICKS; tick++) sim.tick(idle);
    expect(player.attack).toMatchObject({ kind: 'melee', phase: 'windup', t: MELEE_WINDUP_TICKS });
  });

  it('lets block cancel recovery but never overlap windup or active frames', () => {
    const sim = new Sim(42);
    const { player } = closeWolf(sim);

    expect(sim.playerMelee()).toBe(true);
    sim.tick({ ...idle, block: true });
    expect(player.attack?.phase).toBe('windup');
    expect(player.blocking).toBe(false);

    for (let tick = 1; tick < MELEE_WINDUP_TICKS + MELEE_ACTIVE_TICKS; tick++) sim.tick(idle);
    expect(player.attack?.phase).toBe('recover');
    sim.tick({ ...idle, block: true });
    expect(player.attack).toBeNull();
    expect(player.blocking).toBe(true);
  });

  it('emits authoritative reasons when an attack cannot start', () => {
    const sim = new Sim(42);
    const { player } = closeWolf(sim);
    player.stamina = 0;

    expect(sim.playerMelee()).toBe(false);
    expect(sim.events.at(-1)).toMatchObject({
      type: 'actionRejected',
      actorId: player.id,
      action: 'melee',
      reason: 'stamina',
    });
    sim.tick(idle);
    expect(sim.events.at(-1)).toMatchObject({ type: 'actionRejected', reason: 'stamina' });

    player.stamina = player.stats.maxStamina;
    expect(sim.playerMelee()).toBe(true);
    expect(sim.playerMelee()).toBe(false);
    expect(sim.events.at(-1)).toMatchObject({
      type: 'actionRejected',
      actorId: player.id,
      action: 'melee',
      reason: 'busy',
    });
  });
});

describe('Plan 2 melee and blocking geometry', () => {
  it('does not hit a target outside the vertical melee envelope', () => {
    const sim = new Sim(42);
    const { wolf } = closeWolf(sim);
    wolf.pos.y = sim.player().pos.y + 3;
    const healthBefore = wolf.health;

    expect(sim.playerMelee()).toBe(true);
    for (let tick = 0; tick < MELEE_WINDUP_TICKS; tick++) sim.tick(idle);

    expect(wolf.health).toBe(healthBefore);
  });

  it('does not damage party members inside a player melee arc', () => {
    const sim = new Sim(42);
    sim.addPlayer('p2', 'Brona');
    const player = sim.player();
    const partyMember = sim.playerActor('p2')!;
    partyMember.pos = { ...player.pos, z: player.pos.z + 1.5 };
    player.yaw = 0;
    const healthBefore = partyMember.health;

    expect(sim.playerMelee()).toBe(true);
    for (let tick = 0; tick < MELEE_WINDUP_TICKS; tick++) sim.tick(idle);

    expect(partyMember.health).toBe(healthBefore);
  });

  it('blocks frontal attacks, but not attacks from behind or source-less damage', () => {
    const frontal = new Sim(42);
    const front = closeWolf(frontal);
    front.player.blocking = true;
    const frontStamina = front.player.stamina;
    frontal.context().dealDamage(front.player.id, front.wolf.id, 30, 'physical');
    const frontEvent = frontal.events.find((event) => event.type === 'damage');
    expect(frontEvent).toMatchObject({ type: 'damage', blocked: true });
    expect(front.player.stamina).toBe(frontStamina - BLOCK_STAMINA_ON_HIT);

    const rear = new Sim(42);
    const back = closeWolf(rear);
    back.wolf.pos.z = back.player.pos.z - 1.5;
    back.player.blocking = true;
    const rearStamina = back.player.stamina;
    rear.context().dealDamage(back.player.id, back.wolf.id, 30, 'physical');
    const rearEvent = rear.events.find((event) => event.type === 'damage');
    expect(rearEvent).toMatchObject({ type: 'damage', blocked: false });
    expect(back.player.stamina).toBe(rearStamina);

    const sourceLess = new Sim(42);
    const sourceLessPlayer = sourceLess.player();
    sourceLessPlayer.blocking = true;
    sourceLess.context().dealDamage(sourceLessPlayer.id, 0, 30, 'fire');
    expect(sourceLess.events.find((event) => event.type === 'damage')).toMatchObject({
      type: 'damage',
      blocked: false,
    });
  });

  it('blocks by projectile approach direction even if the shooter moves behind the defender', () => {
    const sim = new Sim(42);
    const player = sim.player();
    const archer = [...sim.actors.values()].find((actor) => actor.templateId === 'redclaw_archer')!;
    player.yaw = 0;
    archer.pos = { ...player.pos, z: player.pos.z + 10 };
    archer.yaw = Math.PI;
    archer.brain = null;

    expect(startRanged(sim.context(), archer.id)).toBe(true);
    for (let tick = 0; tick < RANGED_WINDUP_TICKS; tick++) {
      sim.tick({ ...idle, block: true });
    }
    expect(sim.projectiles).toHaveLength(1);
    archer.pos.z = player.pos.z - 10;

    let impact = sim.events.find((event) => event.type === 'damage');
    for (let tick = 0; tick < 30 && !impact; tick++) {
      sim.tick({ ...idle, block: true });
      impact = sim.events.find((event) => event.type === 'damage');
    }

    expect(impact).toMatchObject({ type: 'damage', targetId: player.id, blocked: true });
  });
});

describe('Plan 2 projectile/world collision', () => {
  it('stops a spell on a solid mine pillar before it can damage an actor behind it', () => {
    const sim = new Sim(42);
    const player = sim.player();
    const target = [...sim.actors.values()].find((actor) => actor.templateId === 'marsh_rat')!;
    player.pos = { spaceId: 'duskhollow_mine', x: -6, y: 0, z: 32 };
    player.yaw = Math.PI / 2;
    target.pos = { spaceId: 'duskhollow_mine', x: -2, y: 0, z: 32 };
    target.brain = null;
    const healthBefore = target.health;

    expect(sim.playerCast('flamebolt')).toBe(true);
    for (let tick = 0; tick < 50; tick++) sim.tick({ ...idle, yaw: Math.PI / 2 });

    expect(target.health).toBe(healthBefore);
    expect(sim.projectiles).toHaveLength(0);
  });

  it('stops a spell at an implicit interior wall between disconnected room areas', () => {
    const sim = new Sim(42);
    const player = sim.player();
    player.pos = { spaceId: 'duskhollow_mine', x: 4, y: 0, z: 8 };
    player.yaw = 0;

    expect(sim.playerCast('flamebolt')).toBe(true);
    for (let tick = 0; tick < 35; tick++) sim.tick({ ...idle, yaw: 0 });

    expect(sim.projectiles).toHaveLength(0);
  });
});

describe('Plan 2 authoritative telegraph presentation', () => {
  it('exposes the exact frontal danger shape and interrupt state to hosts', () => {
    const sim = new Sim(42);
    const player = sim.player();
    const boss = [...sim.actors.values()].find((actor) => actor.templateId === 'barrow_wight')!;
    const ability = sim.content.actors.barrow_wight.abilities!.find((candidate) => candidate.id === 'pale_breath')!;
    player.pos = { spaceId: 'duskhollow_mine', x: 0, y: 0, z: 56 };
    boss.pos = { spaceId: 'duskhollow_mine', x: 0, y: 0, z: 60 };
    boss.yaw = Math.PI;

    expect(startAbility(sim.context(), boss, ability)).toBe(true);
    const view = new SimWorld(sim).actorsInSpace().find((actor) => actor.id === boss.id)!;

    expect(view.attackPhase).toBe('windup');
    expect(view.telegraph).toMatchObject({
      kind: 'frontal_cone',
      ticks: ability.telegraphTicks,
      totalTicks: ability.telegraphTicks,
      interruptible: true,
      range: ability.range,
      angleDegrees: ability.coneDegrees,
      x: boss.pos.x,
      z: boss.pos.z,
    });
  });
});
