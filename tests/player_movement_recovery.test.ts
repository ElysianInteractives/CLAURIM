import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/sim/content';
import { ClientWorld } from '../src/net/client_world';
import { PROTOCOL_VERSION, type SelfState, type ServerMessage } from '../src/net/protocol';
import { IDLE_INPUT, Sim } from '../src/sim/sim';
import { DT, SPRINT_MULT, SPRINT_STAMINA_PER_SEC } from '../src/sim/types';
import type { ActorView } from '../src/world_api';
import {
  SPRINT_RESTART_FRACTION,
  advanceSprint,
  localMovementToWorld,
  regenerateStamina,
} from '../src/sim/player/movement';

const SEED = 20260730;

function makePlayerSim(): Sim {
  const sim = new Sim(SEED, CONTENT, { skipSpawn: true, noDefaultPlayer: true });
  sim.addPlayer('p1', 'Wanderer');
  return sim;
}

function makeClientWorld(stamina: number, sprinting: boolean): ClientWorld {
  const world = new ClientWorld('p1', 'Wanderer', () => 0);
  world.beginSession({ send: () => undefined });
  world.onMessage(JSON.stringify({
    t: 'welcome',
    protocol: PROTOCOL_VERSION,
    charId: 'p1',
    entityId: 1,
    seed: SEED,
    tick: 0,
    snapshotEvery: 3,
  } satisfies ServerMessage));

  const resources: SelfState['resources'] = {
    health: 100,
    maxHealth: 100,
    stamina,
    maxStamina: 100,
    magicka: 100,
    maxMagicka: 100,
    level: 1,
    xp: 0,
    xpForNext: 100,
    perkPoints: 0,
    gold: 0,
  };
  const actor: ActorView = {
    id: 1,
    templateId: 'player',
    archetype: 'player',
    name: 'Wanderer',
    x: 0,
    y: 0,
    z: 6,
    yaw: 0,
    aimPitch: 0,
    dead: false,
    downed: false,
    health: 100,
    maxHealth: 100,
    sneaking: false,
    blocking: false,
    attacking: false,
    attackKind: null,
    attackPhase: null,
    telegraphTicks: 0,
    isPlayer: true,
    isRemotePlayer: false,
    hostileToPlayer: false,
    hasDialogue: false,
    tier: 'standard',
  };
  world.onMessage(JSON.stringify({
    t: 'snapshot',
    tick: 0,
    ackSeq: 0,
    gameHours: 8,
    self: {
      charId: 'p1',
      entityId: 1,
      x: 0,
      y: 0,
      z: 6,
      yaw: 0,
      aimPitch: 0,
      spaceId: 'fenharrow_inn',
      spaceKind: 'interior',
      downed: false,
      downedTicks: 0,
      movement: { moveSpeed: 4.4, staminaRegen: 10, sprinting },
      resources,
      inventory: [],
      equipment: [],
      skills: [],
      knownSpells: [],
      equippedSpells: [],
      journal: [],
      perks: [],
      partyId: null,
      party: [],
      partyInvites: [],
      dialogue: null,
      shop: null,
      prompt: null,
    },
    actors: [actor],
    projectiles: [],
    aoes: [],
    events: [],
  } satisfies ServerMessage));
  return world;
}

describe('QA Phase A camera-relative movement', () => {
  it('maps screen-left and screen-right through the camera basis', () => {
    expect(localMovementToWorld(1, 0, 0)).toMatchObject({ x: -1, z: 0, moving: true });
    expect(localMovementToWorld(-1, 0, 0)).toMatchObject({ x: 1, z: 0, moving: true });
    expect(localMovementToWorld(0, 1, 0)).toMatchObject({ x: 0, z: 1, moving: true });

    const turnedRight = localMovementToWorld(1, 0, Math.PI / 2);
    expect(turnedRight.x).toBeCloseTo(0);
    expect(turnedRight.z).toBeCloseTo(1);
  });

  it('uses the corrected basis in the authoritative simulation', () => {
    const sim = makePlayerSim();
    sim.movePlayerTo('p1', 'fenharrow_inn', 0, 6, 0);
    const before = { ...sim.player().pos };

    sim.tick({ ...IDLE_INPUT, moveX: 1, yaw: 0 });

    expect(sim.player().pos.x).toBeLessThan(before.x);
    expect(sim.player().pos.z).toBeCloseTo(before.z);
  });

  it('uses the same corrected basis in online prediction', () => {
    const world = makeClientWorld(100, false);
    world.step({ ...IDLE_INPUT, moveX: 1, yaw: 0 });

    expect(world.player().x).toBeLessThan(0);
    expect(world.player().z).toBeCloseTo(6);
  });
});

describe('QA Phase A sprint exhaustion', () => {
  it('stops at exhaustion and waits for the restart floor', () => {
    const maxStamina = 100;
    const almostEmpty = SPRINT_STAMINA_PER_SEC * DT * 0.5;
    const exhausted = advanceSprint(true, false, true, true, almostEmpty, maxStamina);
    expect(exhausted.applied).toBe(true);
    expect(exhausted.active).toBe(false);
    expect(exhausted.stamina).toBe(0);

    const firstRecovery = regenerateStamina(exhausted.stamina, maxStamina, 10, exhausted.active);
    expect(firstRecovery).toBeGreaterThan(0);
    expect(firstRecovery).toBeLessThan(maxStamina * SPRINT_RESTART_FRACTION);
    expect(advanceSprint(true, false, true, false, firstRecovery, maxStamina).applied).toBe(false);
    expect(advanceSprint(true, false, true, false, 10, maxStamina).applied).toBe(true);
  });

  it('returns the authoritative actor to walking speed while sprint remains held', () => {
    const sim = makePlayerSim();
    sim.movePlayerTo('p1', 'fenharrow_inn', 0, 6, 0);
    const player = sim.player();
    player.stamina = SPRINT_STAMINA_PER_SEC * DT * 0.5;
    player.sprinting = true;

    const beforeSprint = player.pos.z;
    sim.tick({ ...IDLE_INPUT, moveZ: 1, sprint: true });
    const sprintDistance = player.pos.z - beforeSprint;
    expect(player.sprinting).toBe(false);
    expect(player.stamina).toBeGreaterThan(0);

    const beforeWalk = player.pos.z;
    sim.tick({ ...IDLE_INPUT, moveZ: 1, sprint: true });
    const walkDistance = player.pos.z - beforeWalk;
    expect(player.sprinting).toBe(false);
    expect(sprintDistance).toBeCloseTo(walkDistance * SPRINT_MULT, 5);
  });

  it('matches exhaustion behavior in online prediction', () => {
    const world = makeClientWorld(SPRINT_STAMINA_PER_SEC * DT * 0.5, true);

    const beforeSprint = world.player().z;
    world.step({ ...IDLE_INPUT, moveZ: 1, sprint: true });
    const sprintDistance = world.player().z - beforeSprint;

    const beforeWalk = world.player().z;
    world.step({ ...IDLE_INPUT, moveZ: 1, sprint: true });
    const walkDistance = world.player().z - beforeWalk;

    expect(sprintDistance).toBeCloseTo(walkDistance * SPRINT_MULT, 5);
  });

  it('does not enter sprint or suppress regeneration while stationary', () => {
    const sim = makePlayerSim();
    const player = sim.player();
    player.stamina = 50;

    sim.tick({ ...IDLE_INPUT, sprint: true });

    expect(player.sprinting).toBe(false);
    expect(player.stamina).toBeGreaterThan(50);
  });
});

describe('QA Phase A safe-ground recovery', () => {
  it('returns a trapped living player without applying death penalties', () => {
    const sim = makePlayerSim();
    sim.movePlayerTo('p1', 'fenharrow_inn', 0, 6, 0);
    const player = sim.player();
    player.health = 47;
    player.stamina = 31;
    player.magicka = 22;

    expect(sim.recoverPlayer('p1')).toBe('recovered');
    expect(player.pos.spaceId).toBe('fenharrow_inn');
    expect(player.pos.x).toBeCloseTo(0);
    expect(player.pos.z).toBeCloseTo(2);
    expect({ health: player.health, stamina: player.stamina, magicka: player.magicka }).toEqual({
      health: 47,
      stamina: 31,
      magicka: 22,
    });
    expect(sim.events).toContainEqual({ type: 'playerRecovered', playerId: player.id });
  });

  it('enforces cooldown and rejects recovery near a hostile', () => {
    const cooldownSim = makePlayerSim();
    expect(cooldownSim.recoverPlayer('p1')).toBe('recovered');
    expect(cooldownSim.recoverPlayer('p1')).toBe('cooldown');
    expect(cooldownSim.events).toContainEqual({
      type: 'recoveryRejected',
      playerId: cooldownSim.player().id,
      reason: 'cooldown',
      secondsRemaining: 30,
    });

    const combatSim = makePlayerSim();
    combatSim.movePlayerTo('p1', 'fenharrow_inn', 0, 6, 0);
    combatSim.spawnFromTemplate('redclaw_raider', 'fenharrow_inn', { x: 2, y: 0, z: 6 }, 0);
    expect(combatSim.recoverPlayer('p1')).toBe('combat');
  });
});
