// Space-aware ground and walkability queries. One entry point for every
// consumer (movement, AI, navigation, spawning, renderer): they may not
// disagree about where the floor is.

import type { SpaceId } from '../types';
import type { ContentRegistry, InteriorLayout } from '../content/schema';
import { MAX_WALK_SLOPE, slopeAt, terrainHeight, WATER_LEVEL } from './terrain';

export function interiorOf(content: ContentRegistry, spaceId: SpaceId): InteriorLayout | null {
  const s = content.spaces[spaceId];
  return s && s.kind === 'interior' && s.interior ? s.interior : null;
}

export function insideRooms(layout: InteriorLayout, x: number, z: number): boolean {
  for (const r of layout.rooms) {
    if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return true;
  }
  return false;
}

/** A body of radius r fits at (x, z) inside the room UNION. Checked as the
 * center plus four cardinal offsets so adjoining rooms stay connected at
 * their seams (a per-room margin would put phantom walls across doorways). */
export function bodyFitsInRooms(layout: InteriorLayout, x: number, z: number, r: number): boolean {
  return (
    insideRooms(layout, x, z) &&
    insideRooms(layout, x + r, z) &&
    insideRooms(layout, x - r, z) &&
    insideRooms(layout, x, z + r) &&
    insideRooms(layout, x, z - r)
  );
}

/** Ground height at (x, z) in a space. Interiors are flat floors at y = 0. */
export function groundHeight(
  content: ContentRegistry,
  spaceId: SpaceId,
  x: number,
  z: number,
  seed: number,
): number {
  const layout = interiorOf(content, spaceId);
  if (layout) return 0;
  return terrainHeight(x, z, seed);
}

/** Terrain-level walkability (slope + water + interior walls). Prop collision
 * is layered on top by collision.ts. */
export function isTerrainWalkable(
  content: ContentRegistry,
  spaceId: SpaceId,
  x: number,
  z: number,
  seed: number,
): boolean {
  const layout = interiorOf(content, spaceId);
  if (layout) return bodyFitsInRooms(layout, x, z, 0.4);
  const h = terrainHeight(x, z, seed);
  if (h < WATER_LEVEL - 0.5) return false; // deep water blocks walking
  return slopeAt(x, z, seed) <= MAX_WALK_SLOPE;
}
