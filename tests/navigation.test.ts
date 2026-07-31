// Navigation: interior pathfinding through the mine corridors, wall
// avoidance, exterior slope limits, and AI perception rules.

import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim/sim';
import { CONTENT } from '../src/sim/content';
import { CollisionIndex } from '../src/sim/world/collision';
import { findPath, lineWalkable } from '../src/sim/navigation/navgrid';
import { insideRooms, interiorOf, isTerrainWalkable } from '../src/sim/world/spaces';
import { canPerceive } from '../src/sim/ai/brain';

const colliders = new CollisionIndex(CONTENT);
const SEED = 42;

describe('interior navigation (Duskhollow Mine)', () => {
  it('a path exists from the entrance to the boss vault through the corridors', () => {
    const path = findPath(CONTENT, colliders, 'duskhollow_mine', { x: 0, y: 0, z: 2 }, { x: 0, z: 60 }, SEED);
    expect(path).not.toBeNull();
    // Every waypoint stays on walkable floor.
    const layout = interiorOf(CONTENT, 'duskhollow_mine')!;
    for (const wp of path!) {
      expect(insideRooms(layout, wp.x, wp.z), `waypoint ${wp.x},${wp.z} in rooms`).toBe(true);
    }
    // The path threads both corridors: it visits z between 10..26 and 40..52
    // only inside the narrow x band.
    for (const wp of path!) {
      if (wp.z > 11 && wp.z < 25) expect(Math.abs(wp.x)).toBeLessThanOrEqual(1.5);
      if (wp.z > 41 && wp.z < 51) expect(Math.abs(wp.x)).toBeLessThanOrEqual(1.5);
    }
  });

  it('straight line through the gallery wall is not walkable, so A* is needed', () => {
    // From the entrance hall to the flooded gallery's west edge: the straight
    // segment cuts through solid rock outside the room rects.
    const ok = lineWalkable(CONTENT, colliders, 'duskhollow_mine', { x: -4, y: 0, z: 4 }, { x: -8, z: 30 }, SEED);
    expect(ok).toBe(false);
    const path = findPath(CONTENT, colliders, 'duskhollow_mine', { x: -4, y: 0, z: 4 }, { x: -8, z: 30 }, SEED);
    expect(path).not.toBeNull();
  });

  it('outside the rooms is not walkable', () => {
    expect(isTerrainWalkable(CONTENT, 'duskhollow_mine', 20, 20, SEED)).toBe(false);
    expect(isTerrainWalkable(CONTENT, 'duskhollow_mine', 0, 5, SEED)).toBe(true);
  });
});

describe('second interior exemplar (Siltroot Burrow)', () => {
  it('routes from the nearby road bend to the exterior entrance', () => {
    const entrance = CONTENT.doors.find((door) => door.id === 'door_siltroot_in')!;
    const path = findPath(CONTENT, colliders, 'kaldwyn', { x: 0, y: 0, z: 60 }, entrance, SEED);
    expect(path).not.toBeNull();
  });

  it('routes from the entrance through every chamber to the brood hollow', () => {
    const path = findPath(CONTENT, colliders, 'siltroot_burrow', { x: 0, y: 0, z: 2 }, { x: 0, z: 52 }, SEED);
    expect(path).not.toBeNull();
    const layout = interiorOf(CONTENT, 'siltroot_burrow')!;
    for (const waypoint of path!) {
      expect(insideRooms(layout, waypoint.x, waypoint.z), `waypoint ${waypoint.x},${waypoint.z} in burrow`).toBe(true);
    }
  });
});

describe('exterior walkability', () => {
  it('the settlement is walkable, the high rim is not', () => {
    expect(isTerrainWalkable(CONTENT, 'kaldwyn', 40, 150, SEED)).toBe(true);
    // Sample many rim points; most must be blocked by slope.
    let blocked = 0;
    for (let i = 0; i < 20; i++) {
      if (!isTerrainWalkable(CONTENT, 'kaldwyn', 470, -450 + i * 45, SEED)) blocked++;
    }
    expect(blocked).toBeGreaterThan(8);
  });

  it('solid props block movement', () => {
    // The inn shell at (33, 152).
    expect(colliders.blocked('kaldwyn', 33, 152, 0.45)).toBe(true);
    expect(colliders.blocked('kaldwyn', 45, 158.5, 3)).toBe(true); // well at 42,158
  });
});

describe('perception', () => {
  it('sneaking shrinks detection; the vision cone blocks rear detection', () => {
    const sim = new Sim(SEED);
    const wolf = [...sim.actors.values()].find((a) => a.templateId === 'frostfang_wolf')!;
    const p = sim.player();
    // Put the wolf 10m in front of the player, facing away from the player.
    wolf.pos = { ...p.pos, z: p.pos.z + 10 };
    wolf.yaw = 0; // facing +z, player is behind it
    p.sneaking = false;
    expect(canPerceive(sim.context(), wolf, p)).toBe(false); // behind the cone
    // Turn the wolf around: now it sees the player.
    wolf.yaw = Math.PI;
    expect(canPerceive(sim.context(), wolf, p)).toBe(true);
    // Sneaking with high stealth shortens the range far enough to hide at 10m.
    p.sneaking = true;
    p.stats.stealth = 7;
    expect(canPerceive(sim.context(), wolf, p)).toBe(false);
  });
});
