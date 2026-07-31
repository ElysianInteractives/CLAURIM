// Movement collision: axis-separated slide against solid prop AABBs plus the
// terrain/interior walkability mask. Conservative footprint model (yaw-less
// AABB per prop) -- documented limitation KL-2 in KNOWN_LIMITATIONS.md.

import type { SpaceId, Vec3 } from '../types';
import type { ContentRegistry, PropDef } from '../content/schema';
import { bodyFitsInRooms, groundHeight, interiorOf, isTerrainWalkable } from './spaces';
import { REGION_MAX, REGION_MIN } from './terrain';

export interface Aabb {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  y0: number;
  y1: number;
}

export function propAabb(p: PropDef): Aabb {
  const hx = p.sx / 2;
  const hz = p.sz / 2;
  return { x0: p.x - hx, x1: p.x + hx, z0: p.z - hz, z1: p.z + hz, y0: p.y ?? 0, y1: (p.y ?? 0) + p.sy };
}

export class CollisionIndex {
  private bySpace = new Map<SpaceId, Aabb[]>();

  constructor(content: ContentRegistry) {
    for (const p of content.props) {
      if (!p.solid) continue;
      let list = this.bySpace.get(p.spaceId);
      if (!list) {
        list = [];
        this.bySpace.set(p.spaceId, list);
      }
      list.push(propAabb(p));
    }
  }

  solids(spaceId: SpaceId): readonly Aabb[] {
    return this.bySpace.get(spaceId) ?? [];
  }

  blocked(spaceId: SpaceId, x: number, z: number, radius: number): boolean {
    for (const b of this.solids(spaceId)) {
      if (x + radius > b.x0 && x - radius < b.x1 && z + radius > b.z0 && z - radius < b.z1) {
        return true;
      }
    }
    return false;
  }
}

export const ACTOR_RADIUS = 0.45;

function segmentAabbEntry(from: Vec3, to: Vec3, box: Aabb, padding: number): number | null {
  let t0 = 0;
  let t1 = 1;
  for (const [start, end, min, max] of [
    [from.x, to.x, box.x0 - padding, box.x1 + padding],
    [from.y, to.y, box.y0 - padding, box.y1 + padding],
    [from.z, to.z, box.z0 - padding, box.z1 + padding],
  ] as const) {
    const delta = end - start;
    if (Math.abs(delta) < 1e-9) {
      if (start < min || start > max) return null;
      continue;
    }
    let near = (min - start) / delta;
    let far = (max - start) / delta;
    if (near > far) [near, far] = [far, near];
    t0 = Math.max(t0, near);
    t1 = Math.min(t1, far);
    if (t0 > t1) return null;
  }
  return t0;
}

/** Earliest obstruction along a projectile step, as a [0,1] segment
 * fraction. Sweeps against authored solid props and samples implicit
 * interior/terrain geometry densely enough that a 30 Hz projectile cannot
 * tunnel through a thin room boundary. */
export function projectileObstructionT(
  content: ContentRegistry,
  colliders: CollisionIndex,
  spaceId: SpaceId,
  from: Vec3,
  to: Vec3,
  seed: number,
): number | null {
  let earliest: number | null = null;
  for (const box of colliders.solids(spaceId)) {
    const hit = segmentAabbEntry(from, to, box, 0.03);
    if (hit !== null && (earliest === null || hit < earliest)) earliest = hit;
  }

  const layout = interiorOf(content, spaceId);
  const length = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
  const samples = Math.max(1, Math.ceil(length / 0.05));
  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    if (earliest !== null && t >= earliest) break;
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;
    const z = from.z + (to.z - from.z) * t;
    if (layout && !bodyFitsInRooms(layout, x, z, 0.03)) return t;
    if (groundHeight(content, spaceId, x, z, seed) > y) return t;
  }
  return earliest;
}

/** Move an actor by (dx, dz) with axis-separated sliding. Returns the resolved
 * position with y clamped to the ground. Pure: no actor mutation here. */
export function resolveMove(
  content: ContentRegistry,
  colliders: CollisionIndex,
  spaceId: SpaceId,
  from: Vec3,
  dx: number,
  dz: number,
  seed: number,
): Vec3 {
  let x = from.x;
  let z = from.z;

  const tryAxis = (nx: number, nz: number): boolean => {
    if (nx < REGION_MIN || nx > REGION_MAX || nz < REGION_MIN || nz > REGION_MAX) return false;
    if (!isTerrainWalkable(content, spaceId, nx, nz, seed)) return false;
    if (colliders.blocked(spaceId, nx, nz, ACTOR_RADIUS)) return false;
    return true;
  };

  if (dx !== 0 && tryAxis(x + dx, z)) x += dx;
  if (dz !== 0 && tryAxis(x, z + dz)) z += dz;

  return { x, y: groundHeight(content, spaceId, x, z, seed), z };
}
