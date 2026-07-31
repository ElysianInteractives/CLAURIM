// Cell / streaming architecture (LOCKED D-004).
// Exteriors are divided into CELL_SIZE squares. The sim keeps ALL actors alive
// (quest references stay valid) but only ticks AI inside the active radius
// around the player; the renderer streams terrain/decoration meshes per cell.
// Interiors are a single always-active cell while occupied.

import type { SpaceId } from '../types';

export const CELL_SIZE = 64;
/** Active radius in cells (2 => a 5x5 block around the player). */
export const ACTIVE_RADIUS = 2;

export interface CellCoord {
  cx: number;
  cz: number;
}

export function cellOf(x: number, z: number): CellCoord {
  return { cx: Math.floor(x / CELL_SIZE), cz: Math.floor(z / CELL_SIZE) };
}

export function cellKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

/** Cells within ACTIVE_RADIUS (chebyshev) of the given position. */
export function activeCells(x: number, z: number): CellCoord[] {
  const { cx, cz } = cellOf(x, z);
  const out: CellCoord[] = [];
  for (let dz = -ACTIVE_RADIUS; dz <= ACTIVE_RADIUS; dz++) {
    for (let dx = -ACTIVE_RADIUS; dx <= ACTIVE_RADIUS; dx++) {
      out.push({ cx: cx + dx, cz: cz + dz });
    }
  }
  return out;
}

export function activeCellKeys(x: number, z: number): Set<string> {
  const set = new Set<string>();
  for (const c of activeCells(x, z)) set.add(cellKey(c.cx, c.cz));
  return set;
}

/** Whether a point is inside the active block around (px, pz). Interiors are
 * always active while the player occupies the same space. */
export function isActiveAt(
  playerSpace: SpaceId,
  px: number,
  pz: number,
  spaceId: SpaceId,
  x: number,
  z: number,
  playerSpaceIsExterior: boolean,
): boolean {
  if (playerSpace !== spaceId) return false;
  if (!playerSpaceIsExterior) return true;
  const a = cellOf(px, pz);
  const b = cellOf(x, z);
  return Math.abs(a.cx - b.cx) <= ACTIVE_RADIUS && Math.abs(a.cz - b.cz) <= ACTIVE_RADIUS;
}
