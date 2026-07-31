// Space-aware ground and walkability queries. One entry point for every
// consumer (movement, AI, navigation, spawning, renderer): they may not
// disagree about where the floor is.

import type { SpaceId } from '../types';
import type { ContentRegistry, InteriorLayout } from '../content/schema';
import { MAX_WALK_SLOPE, slopeAt, terrainHeight, WATER_LEVEL } from './terrain';

/** Current-milestone water policy: there is no swimming state. Actors may
 * wade through at most this much water; deeper water is a hard traversal
 * boundary for players and navigation alike. */
export const MAX_WADING_DEPTH = 0.5;

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

export interface RoomBoundarySegment {
  /** Axis along which the wall extends. */
  axis: 'x' | 'z';
  fixed: number;
  from: number;
  to: number;
}

function subtractIntervals(
  from: number,
  to: number,
  openings: readonly { from: number; to: number }[],
): { from: number; to: number }[] {
  const clipped = openings
    .map((opening) => ({
      from: Math.max(from, opening.from),
      to: Math.min(to, opening.to),
    }))
    .filter((opening) => opening.to - opening.from > 1e-6)
    .sort((a, b) => a.from - b.from);
  const merged: { from: number; to: number }[] = [];
  for (const opening of clipped) {
    const previous = merged[merged.length - 1];
    if (previous && opening.from <= previous.to + 1e-6) {
      previous.to = Math.max(previous.to, opening.to);
    } else {
      merged.push({ ...opening });
    }
  }

  const walls: { from: number; to: number }[] = [];
  let cursor = from;
  for (const opening of merged) {
    if (opening.from > cursor + 1e-6) walls.push({ from: cursor, to: opening.from });
    cursor = Math.max(cursor, opening.to);
  }
  if (cursor < to - 1e-6) walls.push({ from: cursor, to });
  return walls;
}

/** Exact boundary segments of a room union. The renderer uses these instead
 * of dropping an entire room edge when only a narrow doorway overlaps it. */
export function roomBoundarySegments(layout: InteriorLayout): RoomBoundarySegment[] {
  const segments: RoomBoundarySegment[] = [];
  const epsilon = 1e-4;
  for (const room of layout.rooms) {
    for (const [fixed, outside] of [
      [room.z0, room.z0 - epsilon],
      [room.z1, room.z1 + epsilon],
    ] as const) {
      const openings = layout.rooms
        .filter((other) => other !== room && outside >= other.z0 && outside <= other.z1)
        .map((other) => ({ from: other.x0, to: other.x1 }));
      for (const wall of subtractIntervals(room.x0, room.x1, openings)) {
        segments.push({ axis: 'x', fixed, ...wall });
      }
    }
    for (const [fixed, outside] of [
      [room.x0, room.x0 - epsilon],
      [room.x1, room.x1 + epsilon],
    ] as const) {
      const openings = layout.rooms
        .filter((other) => other !== room && outside >= other.x0 && outside <= other.x1)
        .map((other) => ({ from: other.z0, to: other.z1 }));
      for (const wall of subtractIntervals(room.z0, room.z1, openings)) {
        segments.push({ axis: 'z', fixed, ...wall });
      }
    }
  }

  const seen = new Set<string>();
  return segments.filter((segment) => {
    const key = `${segment.axis}:${segment.fixed.toFixed(4)}:${segment.from.toFixed(4)}:${segment.to.toFixed(4)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

export function waterDepthAt(
  content: ContentRegistry,
  spaceId: SpaceId,
  x: number,
  z: number,
  seed: number,
): number {
  if (interiorOf(content, spaceId)) return 0;
  return Math.max(0, WATER_LEVEL - terrainHeight(x, z, seed));
}

/** Terrain-level walkability (slope + water + interior walls). Prop collision
 * is layered on top by collision.ts. */
export function isTerrainWalkable(
  content: ContentRegistry,
  spaceId: SpaceId,
  x: number,
  z: number,
  seed: number,
  bodyRadius = 0.4,
): boolean {
  const layout = interiorOf(content, spaceId);
  if (layout) return bodyFitsInRooms(layout, x, z, bodyRadius);
  if (waterDepthAt(content, spaceId, x, z, seed) > MAX_WADING_DEPTH) return false;
  return slopeAt(x, z, seed) <= MAX_WALK_SLOPE;
}
