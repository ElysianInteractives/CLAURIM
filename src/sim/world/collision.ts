// Shared environmental collision for movement, navigation, projectiles, and
// host-side camera obstruction. Solid props use the same authored yaw and
// terrain-relative height as their rendered meshes.

import type { SpaceId, Vec3 } from '../types';
import type { ContentRegistry, PropDef } from '../content/schema';
import { bodyFitsInRooms, groundHeight, interiorOf, isTerrainWalkable } from './spaces';
import { REGION_MAX, REGION_MIN } from './terrain';

export interface PropCollider {
  id: string;
  spaceId: SpaceId;
  x: number;
  z: number;
  halfX: number;
  halfZ: number;
  yaw: number;
  authoredY?: number;
  height: number;
}

export function propCollider(p: PropDef): PropCollider {
  return {
    id: p.id,
    spaceId: p.spaceId,
    x: p.x,
    z: p.z,
    halfX: p.sx / 2,
    halfZ: p.sz / 2,
    yaw: p.yaw ?? 0,
    authoredY: p.y,
    height: p.sy,
  };
}

function toLocal(box: PropCollider, x: number, z: number): { x: number; z: number } {
  const dx = x - box.x;
  const dz = z - box.z;
  const c = Math.cos(box.yaw);
  const s = Math.sin(box.yaw);
  return {
    x: c * dx - s * dz,
    z: s * dx + c * dz,
  };
}

export class CollisionIndex {
  private bySpace = new Map<SpaceId, PropCollider[]>();

  constructor(content: ContentRegistry) {
    for (const p of content.props) {
      if (!p.solid) continue;
      let list = this.bySpace.get(p.spaceId);
      if (!list) {
        list = [];
        this.bySpace.set(p.spaceId, list);
      }
      list.push(propCollider(p));
    }
  }

  solids(spaceId: SpaceId): readonly PropCollider[] {
    return this.bySpace.get(spaceId) ?? [];
  }

  blocked(spaceId: SpaceId, x: number, z: number, radius: number): boolean {
    for (const box of this.solids(spaceId)) {
      const local = toLocal(box, x, z);
      const nearestX = Math.max(-box.halfX, Math.min(box.halfX, local.x));
      const nearestZ = Math.max(-box.halfZ, Math.min(box.halfZ, local.z));
      const dx = local.x - nearestX;
      const dz = local.z - nearestZ;
      if (dx * dx + dz * dz <= radius * radius) return true;
    }
    return false;
  }
}

export const ACTOR_RADIUS = 0.45;
const MOVE_SUBSTEP = 0.2;

function segmentBoxEntry(
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  minZ: number,
  maxZ: number,
): number | null {
  let t0 = 0;
  let t1 = 1;
  for (const [start, end, min, max] of [
    [from.x, to.x, minX, maxX],
    [from.y, to.y, minY, maxY],
    [from.z, to.z, minZ, maxZ],
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

function segmentPropEntry(
  content: ContentRegistry,
  box: PropCollider,
  from: Vec3,
  to: Vec3,
  seed: number,
  padding: number,
): number | null {
  const localFrom = toLocal(box, from.x, from.z);
  const localTo = toLocal(box, to.x, to.z);
  const y0 = box.authoredY ?? groundHeight(content, box.spaceId, box.x, box.z, seed);
  return segmentBoxEntry(
    { x: localFrom.x, y: from.y, z: localFrom.z },
    { x: localTo.x, y: to.y, z: localTo.z },
    -box.halfX - padding,
    box.halfX + padding,
    y0 - padding,
    y0 + box.height + padding,
    -box.halfZ - padding,
    box.halfZ + padding,
  );
}

/** Whether an actor-sized body can occupy one point. Movement and navigation
 * both route through this exact query. */
export function positionTraversable(
  content: ContentRegistry,
  colliders: CollisionIndex,
  spaceId: SpaceId,
  x: number,
  z: number,
  seed: number,
  radius = ACTOR_RADIUS,
): boolean {
  const space = content.spaces[spaceId];
  if (!space) return false;
  const exterior = space.kind === 'exterior';
  if (
    exterior &&
    (x - radius < REGION_MIN ||
      x + radius > REGION_MAX ||
      z - radius < REGION_MIN ||
      z + radius > REGION_MAX)
  ) {
    return false;
  }
  if (!isTerrainWalkable(content, spaceId, x, z, seed, radius)) return false;
  return !colliders.blocked(spaceId, x, z, radius);
}

/** Deterministic recovery for authored/runtime placement near an obstruction.
 * The requested point wins; otherwise concentric rings are checked nearest
 * first. */
export function nearestTraversablePoint(
  content: ContentRegistry,
  colliders: CollisionIndex,
  spaceId: SpaceId,
  x: number,
  z: number,
  seed: number,
  maxRadius = 6,
): Vec3 | null {
  if (positionTraversable(content, colliders, spaceId, x, z, seed)) {
    return { x, y: groundHeight(content, spaceId, x, z, seed), z };
  }
  for (let radius = 0.5; radius <= maxRadius; radius += 0.5) {
    const samples = Math.max(8, Math.ceil((Math.PI * 2 * radius) / 0.5));
    for (let index = 0; index < samples; index++) {
      const angle = (index / samples) * Math.PI * 2;
      const candidateX = x + Math.cos(angle) * radius;
      const candidateZ = z + Math.sin(angle) * radius;
      if (positionTraversable(content, colliders, spaceId, candidateX, candidateZ, seed)) {
        return {
          x: candidateX,
          y: groundHeight(content, spaceId, candidateX, candidateZ, seed),
          z: candidateZ,
        };
      }
    }
  }
  return null;
}

/** Earliest obstruction along a 3D segment, as a [0,1] fraction. Authored
 * props, interior wall/ceiling/floor boundaries, and terrain share this
 * query. `padding` expands geometry for camera clearance. */
export function worldObstructionT(
  content: ContentRegistry,
  colliders: CollisionIndex,
  spaceId: SpaceId,
  from: Vec3,
  to: Vec3,
  seed: number,
  padding = 0.03,
): number | null {
  let earliest: number | null = null;
  for (const box of colliders.solids(spaceId)) {
    const hit = segmentPropEntry(content, box, from, to, seed, padding);
    if (hit !== null && (earliest === null || hit < earliest)) earliest = hit;
  }

  const layout = interiorOf(content, spaceId);
  const length = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
  const samples = Math.max(1, Math.ceil(length / 0.05));
  const sampleBlocked = (t: number): boolean => {
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;
    const z = from.z + (to.z - from.z) * t;
    if (layout) {
      if (!bodyFitsInRooms(layout, x, z, padding)) return true;
      if (y < padding || y > layout.ceilingY - padding) return true;
    }
    return groundHeight(content, spaceId, x, z, seed) + padding > y;
  };
  for (let index = 1; index <= samples; index++) {
    const t = index / samples;
    if (earliest !== null && t >= earliest) break;
    if (sampleBlocked(t)) {
      // The 5 cm march finds a conservative bracket. Refine its entry so a
      // camera moving over terrain or an interior boundary does not jump in
      // visible 5 cm increments. This does not discover new obstructions or
      // change the authoritative yes/no result; it only improves hit precision.
      let clearT = (index - 1) / samples;
      let blockedT = t;
      if (sampleBlocked(clearT)) return clearT;
      for (let iteration = 0; iteration < 9; iteration++) {
        const middle = (clearT + blockedT) / 2;
        if (sampleBlocked(middle)) blockedT = middle;
        else clearT = middle;
      }
      return blockedT;
    }
  }
  return earliest;
}

/** Projectile-specific wrapper retained at the combat seam. */
export function projectileObstructionT(
  content: ContentRegistry,
  colliders: CollisionIndex,
  spaceId: SpaceId,
  from: Vec3,
  to: Vec3,
  seed: number,
): number | null {
  return worldObstructionT(content, colliders, spaceId, from, to, seed, 0.03);
}

/** Move an actor by (dx, dz) with substepped axis-separated sliding. Long
 * debug/AI moves cannot tunnel through props, steep terrain, or room walls. */
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
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / MOVE_SUBSTEP));
  const stepX = dx / steps;
  const stepZ = dz / steps;

  for (let index = 0; index < steps; index++) {
    if (stepX !== 0 && positionTraversable(content, colliders, spaceId, x + stepX, z, seed)) {
      x += stepX;
    }
    if (stepZ !== 0 && positionTraversable(content, colliders, spaceId, x, z + stepZ, seed)) {
      z += stepZ;
    }
  }

  return { x, y: groundHeight(content, spaceId, x, z, seed), z };
}
