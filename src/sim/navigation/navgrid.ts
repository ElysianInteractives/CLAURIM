// Grid A* pathfinding over the shared walkability queries. Paths are computed
// on demand inside a bounded window around start/goal (streaming-safe: the
// window never exceeds the active cell block). Exteriors and interiors use the
// same code path because walkability is space-aware.

import type { SpaceId, Vec3 } from '../types';
import type { ContentRegistry } from '../content/schema';
import { CollisionIndex, positionTraversable } from '../world/collision';
import { groundHeight } from '../world/spaces';

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
  return positionTraversable(content, colliders, spaceId, x, z, seed);
}

function segmentWalkable(
  content: ContentRegistry,
  colliders: CollisionIndex,
  spaceId: SpaceId,
  from: { x: number; z: number },
  to: { x: number; z: number },
  seed: number,
): boolean {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const distance = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(distance / 0.2));
  let previousHeight = groundHeight(content, spaceId, from.x, from.z, seed);
  for (let index = 1; index <= steps; index++) {
    const t = index / steps;
    const x = from.x + dx * t;
    const z = from.z + dz * t;
    if (!walkable(content, colliders, spaceId, x, z, seed)) return false;
    const height = groundHeight(content, spaceId, x, z, seed);
    if (Math.abs(height - previousHeight) > 1.6) return false;
    previousHeight = height;
  }
  return true;
}

/** A* on a NAV_STEP lattice anchored at the exact start point. Returns waypoints
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
  if (!walkable(content, colliders, spaceId, start.x, start.z, seed)) return null;
  if (!walkable(content, colliders, spaceId, goal.x, goal.z, seed)) return null;

  const sx = 0;
  const sz = 0;
  const gx = Math.round(dx / NAV_STEP);
  const gz = Math.round(dz / NAV_STEP);
  const worldPoint = (x: number, z: number) => ({
    x: start.x + x * NAV_STEP,
    z: start.z + z * NAV_STEP,
  });

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

    const terminal = worldPoint(cur.x, cur.z);
    if (
      Math.hypot(terminal.x - goal.x, terminal.z - goal.z) <= NAV_STEP * 1.5 &&
      segmentWalkable(content, colliders, spaceId, terminal, goal, seed)
    ) {
      const path: Vec3[] = [];
      let n: Node | null = cur;
      while (n) {
        const point = worldPoint(n.x, n.z);
        path.push({
          x: point.x,
          y: groundHeight(content, spaceId, point.x, point.z, seed),
          z: point.z,
        });
        n = n.parent;
      }
      path.reverse();
      const last = path[path.length - 1];
      if (Math.hypot(last.x - goal.x, last.z - goal.z) > 1e-6) {
        path.push({
          x: goal.x,
          y: groundHeight(content, spaceId, goal.x, goal.z, seed),
          z: goal.z,
        });
      }
      return path;
    }

    for (const [ddx, ddz, cost] of DIRS) {
      const nx = cur.x + ddx;
      const nz = cur.z + ddz;
      const nk = key(nx, nz);
      if (closed.has(nk)) continue;
      const currentPoint = worldPoint(cur.x, cur.z);
      const nextPoint = worldPoint(nx, nz);
      if (Math.abs(nextPoint.x - start.x) > MAX_WINDOW || Math.abs(nextPoint.z - start.z) > MAX_WINDOW) continue;
      if (!segmentWalkable(content, colliders, spaceId, currentPoint, nextPoint, seed)) continue;
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
  if (dx === 0 && dz === 0) return walkable(content, colliders, spaceId, to.x, to.z, seed);
  return segmentWalkable(content, colliders, spaceId, from, to, seed);
}
