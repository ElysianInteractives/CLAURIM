// Plan 3 environmental contract: rendered prop orientation, physical
// traversal, projectiles, navigation, authored placements, and transitions
// must agree about the same world.

import { describe, expect, it } from 'vitest';
import { CONTENT, PLAYER_START } from '../src/sim/content';
import { Sim } from '../src/sim/sim';
import {
  ACTOR_RADIUS,
  CollisionIndex,
  positionTraversable,
  projectileObstructionT,
  resolveMove,
  worldObstructionT,
} from '../src/sim/world/collision';
import { findPath } from '../src/sim/navigation/navgrid';
import {
  groundHeight,
  interiorOf,
  isTerrainWalkable,
  MAX_WADING_DEPTH,
  roomBoundarySegments,
  waterDepthAt,
} from '../src/sim/world/spaces';
import { ROAD_POINTS } from '../src/sim/world/terrain';

const SEED = 42;
const colliders = new CollisionIndex(CONTENT);

function traversable(spaceId: string, x: number, z: number): boolean {
  return positionTraversable(CONTENT, colliders, spaceId, x, z, SEED, ACTOR_RADIUS);
}

describe('Plan 3 oriented environmental collision', () => {
  it('uses a rotated prop footprint instead of its unrotated authored box', () => {
    // Smithy: 8x6 at yaw 0.4. This first point is inside the visible rotated
    // wall but outside the old yaw-less box; the second is the inverse.
    expect(colliders.blocked('kaldwyn', 66.3, 136.7, 0.05)).toBe(true);
    expect(colliders.blocked('kaldwyn', 58.2, 138.8, 0.05)).toBe(false);
  });

  it('places exterior projectile obstruction at the rendered terrain height', () => {
    const hit = projectileObstructionT(
      CONTENT,
      colliders,
      'kaldwyn',
      { x: 70, y: 16, z: 136 },
      { x: 54, y: 16, z: 136 },
      SEED,
    );
    expect(hit).not.toBeNull();
  });

  it('uses the same world obstruction for a third-person camera boom', () => {
    const hit = worldObstructionT(
      CONTENT,
      colliders,
      'kaldwyn',
      { x: 70, y: 16, z: 136 },
      { x: 54, y: 16, z: 136 },
      SEED,
      0.22,
    );
    expect(hit).not.toBeNull();
    expect(hit!).toBeGreaterThan(0);
    expect(hit!).toBeLessThan(1);
  });

  it('refines terrain camera contact below the coarse five-centimetre march', () => {
    const from = { x: -480, y: 78.34232721355299, z: -480 };
    const to = { x: -480.9, y: 79.82675096908012, z: -485.8134745302639 };
    const hit = worldObstructionT(CONTENT, colliders, 'kaldwyn', from, to, 20260730, 0.22);
    expect(hit).not.toBeNull();
    const clearance = (t: number): number => {
      const x = from.x + (to.x - from.x) * t;
      const y = from.y + (to.y - from.y) * t;
      const z = from.z + (to.z - from.z) * t;
      return groundHeight(CONTENT, 'kaldwyn', x, z, 20260730) + 0.22 - y;
    };
    expect(Math.abs(clearance(hit!))).toBeLessThan(0.001);
    expect(clearance(hit! - 0.0001)).toBeLessThanOrEqual(0);
    expect(clearance(hit! + 0.0001)).toBeGreaterThan(0);
  });

  it('substeps long movement so an actor cannot tunnel through the smithy', () => {
    const moved = resolveMove(
      CONTENT,
      colliders,
      'kaldwyn',
      { x: 70, y: 14, z: 136 },
      -16,
      0,
      SEED,
    );
    expect(moved.x).toBeGreaterThan(66);
  });

  it('renders only the solid portions of a room-union boundary', () => {
    const layout = interiorOf(CONTENT, 'duskhollow_mine')!;
    const galleryNorth = roomBoundarySegments(layout)
      .filter((segment) => segment.axis === 'x' && segment.fixed === 40)
      .map((segment) => [segment.from, segment.to]);
    expect(galleryNorth).toEqual([
      [-9, -1.5],
      [1.5, 9],
    ]);
  });

  it('defines deep water as blocked and shallow water as wadeable', () => {
    const deep = waterDepthAt(CONTENT, 'kaldwyn', -145, 130, SEED);
    expect(deep).toBeGreaterThan(MAX_WADING_DEPTH);
    expect(isTerrainWalkable(CONTENT, 'kaldwyn', -145, 130, SEED)).toBe(false);
    const shallow = waterDepthAt(CONTENT, 'kaldwyn', -180, 0, SEED);
    expect(shallow).toBeGreaterThan(0);
    expect(shallow).toBeLessThanOrEqual(MAX_WADING_DEPTH);
    expect(isTerrainWalkable(CONTENT, 'kaldwyn', -180, 0, SEED)).toBe(true);
  });
});

describe('Plan 3 authored traversal coverage', () => {
  it('keeps player starts, door endpoints, spawners, schedules, and containers traversable', () => {
    const placements: { label: string; spaceId: string; x: number; z: number }[] = [
      { label: 'player start', ...PLAYER_START },
      ...CONTENT.doors.flatMap((door) => [
        { label: `door ${door.id}`, spaceId: door.spaceId, x: door.x, z: door.z },
        {
          label: `door target ${door.id}`,
          spaceId: door.targetSpaceId,
          x: door.targetX,
          z: door.targetZ,
        },
      ]),
      ...CONTENT.spawners.map((spawner) => ({
        label: `spawner ${spawner.id}`,
        spaceId: spawner.spaceId,
        x: spawner.x,
        z: spawner.z,
      })),
      ...CONTENT.containers.map((container) => ({
        label: `container ${container.id}`,
        spaceId: container.spaceId,
        x: container.x,
        z: container.z,
      })),
      ...Object.values(CONTENT.actors).flatMap((actor) =>
        (actor.schedule ?? []).map((entry, index) => ({
          label: `schedule ${actor.id}[${index}]`,
          spaceId: entry.spaceId,
          x: entry.x,
          z: entry.z,
        })),
      ),
    ];

    for (const placement of placements) {
      expect(
        traversable(placement.spaceId, placement.x, placement.z),
        `${placement.label} at ${placement.spaceId} (${placement.x}, ${placement.z})`,
      ).toBe(true);
    }
  });

  it('executes every authored doorway transition through the interaction path', () => {
    for (const door of CONTENT.doors) {
      const sim = new Sim(SEED, CONTENT, { skipSpawn: true, noDefaultPlayer: true });
      sim.addPlayer('traveler', 'Traveler');
      sim.movePlayerTo('traveler', door.spaceId, door.x, door.z, 0);

      expect(sim.interactFor('traveler'), door.id).toBe('door');
      const player = sim.playerActor('traveler')!;
      expect(player.pos.spaceId, door.id).toBe(door.targetSpaceId);
      expect(
        positionTraversable(
          CONTENT,
          sim.colliders,
          player.pos.spaceId,
          player.pos.x,
          player.pos.z,
          SEED,
        ),
        `${door.id} target (${player.pos.x}, ${player.pos.z})`,
      ).toBe(true);
      expect(Math.hypot(player.pos.x - door.targetX, player.pos.z - door.targetZ), door.id).toBeLessThanOrEqual(4);
    }
  });

  it('finds a physical route along every authored road leg', () => {
    for (let index = 0; index < ROAD_POINTS.length - 1; index++) {
      const from = ROAD_POINTS[index];
      const to = ROAD_POINTS[index + 1];
      const path = findPath(
        CONTENT,
        colliders,
        'kaldwyn',
        { x: from.x, y: 0, z: from.z },
        to,
        SEED,
      );
      expect(path, `road leg ${index}: ${from.x},${from.z} -> ${to.x},${to.z}`).not.toBeNull();
    }
  });

  it('covers every authored space from its entry through every room and interaction anchor', () => {
    const covered = new Set<string>(['kaldwyn']);
    for (const space of Object.values(CONTENT.spaces)) {
      if (space.kind !== 'interior' || !space.interior) continue;
      const inbound = CONTENT.doors.find((door) => door.targetSpaceId === space.id);
      expect(inbound, `${space.id} has an inbound door`).toBeDefined();
      const start = {
        x: inbound!.targetX,
        y: 0,
        z: inbound!.targetZ,
      };
      const goals = [
        ...space.interior.rooms.map((room) => ({
          label: 'room center',
          x: (room.x0 + room.x1) / 2,
          z: (room.z0 + room.z1) / 2,
        })),
        ...CONTENT.doors
          .filter((door) => door.spaceId === space.id)
          .map((door) => ({ label: `door ${door.id}`, x: door.x, z: door.z })),
        ...CONTENT.containers
          .filter((container) => container.spaceId === space.id)
          .map((container) => ({ label: `container ${container.id}`, x: container.x, z: container.z })),
        ...CONTENT.spawners
          .filter((spawner) => spawner.spaceId === space.id)
          .map((spawner) => ({ label: `spawner ${spawner.id}`, x: spawner.x, z: spawner.z })),
      ];
      for (const goal of goals) {
        const path = findPath(CONTENT, colliders, space.id, start, goal, SEED);
        expect(path, `${space.id} entry -> ${goal.label} (${goal.x}, ${goal.z})`).not.toBeNull();
        for (const waypoint of path!) {
          expect(
            traversable(space.id, waypoint.x, waypoint.z),
            `${space.id} waypoint (${waypoint.x}, ${waypoint.z})`,
          ).toBe(true);
        }
      }
      covered.add(space.id);
    }
    expect([...covered].sort()).toEqual(Object.keys(CONTENT.spaces).sort());
  });

  it('places every deterministic initial actor on traversable ground', () => {
    const sim = new Sim(SEED);
    for (const actor of sim.actors.values()) {
      expect(
        positionTraversable(
          CONTENT,
          sim.colliders,
          actor.pos.spaceId,
          actor.pos.x,
          actor.pos.z,
          SEED,
        ),
        `${actor.name} at ${actor.pos.spaceId} (${actor.pos.x}, ${actor.pos.z})`,
      ).toBe(true);
    }
  });
});

describe('Plan 3 multiplayer space transition isolation', () => {
  it('moves only the selected character and clears incompatible transient actions', () => {
    const sim = new Sim(SEED, CONTENT, { skipSpawn: true, noDefaultPlayer: true });
    sim.addPlayer('alva', 'Alva');
    sim.addPlayer('brona', 'Brona');
    const alva = sim.playerActor('alva')!;
    const brona = sim.playerActor('brona')!;
    const bronaBefore = { ...brona.pos };

    alva.attack = { kind: 'melee', phase: 'recover', t: 3 };
    alva.blocking = true;
    alva.sprinting = true;
    sim.movePlayerTo('alva', 'fenharrow_inn', 0, 1.5, 0);

    expect(alva.pos.spaceId).toBe('fenharrow_inn');
    expect(alva.attack).toBeNull();
    expect(alva.blocking).toBe(false);
    expect(alva.sprinting).toBe(false);
    expect(brona.pos).toEqual(bronaBefore);
    expect(sim.isActorActive(alva)).toBe(true);
    expect(sim.isActorActive(brona)).toBe(true);
  });

  it('keeps an environmental actor active near any player and sleeps it when all leave', () => {
    const sim = new Sim(SEED, CONTENT, { skipSpawn: true, noDefaultPlayer: true });
    sim.addPlayer('alva', 'Alva');
    sim.addPlayer('brona', 'Brona');
    sim.movePlayerTo('alva', 'kaldwyn', -400, 300, 0);
    sim.movePlayerTo('brona', 'duskhollow_mine', 0, 5, 0);
    const ratId = sim.spawnFromTemplate(
      'marsh_rat',
      'duskhollow_mine',
      { x: 0, y: 0, z: 8 },
      0,
    );
    const rat = sim.actors.get(ratId)!;

    expect(sim.isActorActive(rat)).toBe(true);
    sim.movePlayerTo('brona', 'kaldwyn', -390, 300, 0);
    expect(sim.isActorActive(rat)).toBe(false);
  });
});
