// Grid A* pathfinding over the shared walkability queries. Paths are computed
// on demand inside a bounded window around start/goal (streaming-safe: the
// window never exceeds the active cell block). Exteriors and interiors use the
// same code path because walkability is space-aware.

import type { SpaceId, Vec3 } from '../types';
import type { ContentRegistry } from '../content/schema';
import { CollisionIndex, ACTOR_RADIUS } from '../world/collision';
import { groundHeight, isTerrainWalkable } from '../world/spaces';

const NAV_STEP = 1.0;
const MAX_WINDOW = 160; // meters; bounded search window
const MAX_EXPANSIONS = 20000;

interface Node {
  x: number;
  z: number;
  g: number;
  f: number;
  parent: Node | null;
}

function walkable(
  content: ContentRegistry,
  colliders: CollisionIndex,
  spaceId: SpaceId,
  x: number,
  z: number,
  seed: number,
): boolean {
  if (!isTerrainWalkable(content, spaceId, x, z, seed)) return false;
  return !colliders.blocked(spaceId, x, z, ACTOR_RADIUS);
}

/** A* on a NAV_STEP lattice anchored at the start point. Returns waypoints
 * (including goal) or null when no path exists within the window. */
export function findPath(
  content: ContentRegistry,
  colliders: CollisionIndex,
  spaceId: SpaceId,
  start: Vec3,
  goal: { x: number; z: number },
  seed: number,
): Vec3[] | null {
  const dx = goal.x - start.x;
  const dz = goal.z - start.z;
  if (Math.abs(dx) > MAX_WINDOW || Math.abs(dz) > MAX_WINDOW) return null;

  const sx = Math.round(start.x / NAV_STEP);
  const sz = Math.round(start.z / NAV_STEP);
  const gx = Math.round(goal.x / NAV_STEP);
  const gz = Math.round(goal.z / NAV_STEP);

  const key = (x: number, z: number) => `${x},${z}`;
  const open: Node[] = [];
  const closed = new Set<string>();
  const best = new Map<string, number>();

  const h = (x: number, z: number) => {
    const ax = Math.abs(x - gx);
    const az = Math.abs(z - gz);
    return Math.max(ax, az) + 0.41 * Math.min(ax, az);
  };

  open.push({ x: sx, z: sz, g: 0, f: h(sx, sz), parent: null });
  best.set(key(sx, sz), 0);

  const DIRS = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, 1.41],
    [1, -1, 1.41],
    [-1, 1, 1.41],
    [-1, -1, 1.41],
  ] as const;

  let expansions = 0;
  while (open.length > 0 && expansions < MAX_EXPANSIONS) {
    // Binary-heap-free pop-min: fine at slice scale; perf ticket in OPUS_BACKLOG.
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    const ck = key(cur.x, cur.z);
    if (closed.has(ck)) continue;
    closed.add(ck);
    expansions++;

    if (cur.x === gx && cur.z === gz) {
      const path: Vec3[] = [];
      let n: Node | null = cur;
      while (n) {
        const wx = n.x * NAV_STEP;
        const wz = n.z * NAV_STEP;
        path.push({ x: wx, y: groundHeight(content, spaceId, wx, wz, seed), z: wz });
        n = n.parent;
      }
      path.reverse();
      path[path.length - 1] = { x: goal.x, y: groundHeight(content, spaceId, goal.x, goal.z, seed), z: goal.z };
      return path;
    }

    for (const [ddx, ddz, cost] of DIRS) {
      const nx = cur.x + ddx;
      const nz = cur.z + ddz;
      const nk = key(nx, nz);
      if (closed.has(nk)) continue;
      const wx = nx * NAV_STEP;
      const wz = nz * NAV_STEP;
      if (Math.abs(wx - start.x) > MAX_WINDOW || Math.abs(wz - start.z) > MAX_WINDOW) continue;
      if (!walkable(content, colliders, spaceId, wx, wz, seed)) continue;
      // Reject steps with a large height jump (cliff edge between lattice points).
      const hCur = groundHeight(content, spaceId, cur.x * NAV_STEP, cur.z * NAV_STEP, seed);
      const hNext = groundHeight(content, spaceId, wx, wz, seed);
      if (Math.abs(hNext - hCur) > 1.6) continue;
      const g = cur.g + cost;
      const prev = best.get(nk);
      if (prev !== undefined && prev <= g) continue;
      best.set(nk, g);
      open.push({ x: nx, z: nz, g, f: g + h(nx, nz), parent: cur });
    }
  }
  return null;
}

/** Straight-line reachability probe used before falling back to A*. */
export function lineWalkable(
  content: ContentRegistry,
  colliders: CollisionIndex,
  spaceId: SpaceId,
  from: Vec3,
  to: { x: number; z: number },
  seed: number,
): boolean {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  const steps = Math.max(1, Math.ceil(dist / 0.8));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (!walkable(content, colliders, spaceId, from.x + dx * t, from.z + dz * t, seed)) return false;
  }
  return true;
}
