import { describe, expect, it } from 'vitest';
import { ClientWorld } from '../src/net/client_world';
import { PROTOCOL_VERSION, type SelfState, type ServerMessage } from '../src/net/protocol';
import type { ActorView } from '../src/world_api';

const resources: SelfState['resources'] = {
  health: 100,
  maxHealth: 100,
  stamina: 100,
  maxStamina: 100,
  magicka: 100,
  maxMagicka: 100,
  level: 1,
  xp: 0,
  xpForNext: 100,
  perkPoints: 0,
  gold: 0,
};

function actor(id: number, x: number, remote: boolean): ActorView {
  return {
    id,
    templateId: remote ? 'guard' : 'player',
    archetype: remote ? 'guard' : 'player',
    name: remote ? 'Remote' : 'Local',
    x,
    y: 10,
    z: 0,
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
    equipment: {},
    isPlayer: true,
    isRemotePlayer: remote,
    hostileToPlayer: false,
    hasDialogue: false,
    tier: 'standard',
  };
}

function snapshot(remoteX: number, tick: number): ServerMessage {
  return {
    t: 'snapshot',
    tick,
    ackSeq: 0,
    gameHours: 8,
    self: {
      charId: 'local',
      entityId: 1,
      x: 0,
      y: 10,
      z: 0,
      yaw: 0,
      aimPitch: 0,
      spaceId: 'kaldwyn',
      spaceKind: 'exterior',
      downed: false,
      downedTicks: 0,
      movement: { moveSpeed: 4.4, staminaRegen: 10, sprinting: false },
      resources,
      inventory: [],
      equipment: [],
      skills: [],
      knownSpells: [],
      equippedSpells: [],
      equippedConsumables: [],
      journal: [],
      perks: [],
      partyId: null,
      party: [],
      partyInvites: [],
      dialogue: null,
      shop: null,
      loot: null,
      prompt: null,
    },
    actors: [actor(1, 0, false), actor(2, remoteX, true)],
    projectiles: [],
    aoes: [],
    events: [],
  };
}

describe('timestamped remote presentation', () => {
  it('is independent of read count and interpolates across the snapshot interval', () => {
    let now = 100;
    const world = new ClientWorld('local', 'Local', () => now);
    world.beginSession({ send: () => undefined });
    world.onMessage(JSON.stringify({
      t: 'welcome',
      protocol: PROTOCOL_VERSION,
      charId: 'local',
      entityId: 1,
      seed: 42,
      tick: 0,
      snapshotEvery: 3,
    } satisfies ServerMessage));
    world.onMessage(JSON.stringify(snapshot(0, 0)));

    now = 200;
    world.onMessage(JSON.stringify(snapshot(2, 3)));
    const repeated = Array.from({ length: 8 }, () => world.actorsInSpace().find((view) => view.id === 2)!.x);
    expect(new Set(repeated)).toEqual(new Set([0]));

    now = 250;
    expect(world.actorsInSpace().find((view) => view.id === 2)).toMatchObject({
      x: 1,
      presentationInterpolated: true,
    });
    now = 300;
    expect(world.actorsInSpace().find((view) => view.id === 2)!.x).toBeCloseTo(2);
  });
});
