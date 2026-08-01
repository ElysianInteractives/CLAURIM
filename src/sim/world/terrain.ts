// Authored geography + procedural detail for the Kaldwyn Reach exterior.
// terrainHeight is a PURE function of (x, z, seed): the renderer, collision,
// navigation, and spawn placement all sample the same function, so they can
// never disagree about the ground. LOCKED D-005.
//
// Authoring model: large-scale shape comes from hand-placed analytic features
// (mountain ridges, the river, the settlement plateau, the road spline);
// fbm noise only adds detail on top. Procedural assists authored, never replaces it.

import { fbm2 } from '../rng';

export const WATER_LEVEL = 3.0;

/** World-space bounds of the authored exterior region (meters). */
export const REGION_MIN = -512;
export const REGION_MAX = 512;

// --- Authored features (Kaldwyn Reach) -------------------------------------

/** Road control points, exterior space, meters. South ruin -> Fenharrow -> mine. */
export const ROAD_POINTS: readonly { x: number; z: number }[] = [
  { x: 40, z: -420 },
  { x: 30, z: -300 },
  { x: -10, z: -180 },
  { x: -30, z: -60 },
  { x: 0, z: 60 },
  { x: 46, z: 144 },
  { x: 60, z: 240 },
  { x: 110, z: 330 },
];

export const SETTLEMENT_CENTER = { x: 40, z: 150 };
export const SETTLEMENT_RADIUS = 70;
export const SETTLEMENT_PLATEAU_H = 14;

/** Thornmere Crossing: a smaller roadside pad south of Fenharrow. */
export const CROSSING_CENTER = { x: -10, z: -180 };
export const CROSSING_RADIUS = 55;
export const CROSSING_PLATEAU_H = 10;

export const RUIN_CENTER = { x: 40, z: -420 };
export const RUIN_RADIUS = 46;
export const RUIN_PLATEAU_H = 22;

export const MINE_ENTRANCE = { x: 118, z: 338 };
export const MINE_ENTRANCE_PLATEAU_H = 19;

/** River runs roughly west-east across the south, meandering. */
function riverCenterX(z: number): number {
  return -180 + Math.sin(z * 0.012) * 40;
}

function dist2(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

/** Distance from (x,z) to the road polyline. */
export function roadDistance(x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i < ROAD_POINTS.length - 1; i++) {
    const a = ROAD_POINTS[i];
    const b = ROAD_POINTS[i + 1];
    const abx = b.x - a.x;
    const abz = b.z - a.z;
    const len2 = abx * abx + abz * abz;
    let t = ((x - a.x) * abx + (z - a.z) * abz) / len2;
    t = Math.max(0, Math.min(1, t));
    const d2 = dist2(x, z, a.x + abx * t, a.z + abz * t);
    if (d2 < best) best = d2;
  }
  return Math.sqrt(best);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Pure heightfield. Meters. */
export function terrainHeight(x: number, z: number, seed: number): number {
  // Base rolling tundra.
  let h = 6 + fbm2(x * 0.008, z * 0.008, seed, 4) * 22;

  // Mountain ring: rises toward the region rim, stronger to the north and east.
  const rimX = Math.max(0, Math.abs(x) - 280) / 232;
  const rimZ = Math.max(0, Math.abs(z) - 300) / 212;
  const rim = Math.min(1, Math.max(rimX, rimZ));
  const northBoost = smoothstep(0, 1, (z + 512) / 1024) * 0.5 + 0.75;
  h += rim * rim * 130 * northBoost * (0.7 + fbm2(x * 0.02, z * 0.02, seed + 7, 3) * 0.6);

  // River valley carve.
  const rDist = Math.abs(x - riverCenterX(z));
  const riverMask = 1 - smoothstep(0, 55, rDist);
  h -= riverMask * (h - 1.2) * 0.9;

  // Site masks are calculated before the road, then applied after it. Authored
  // pads are the final large-scale operation so the road cannot re-carve a
  // supposedly level structure footprint (D-037).
  const sDist = Math.sqrt(dist2(x, z, SETTLEMENT_CENTER.x, SETTLEMENT_CENTER.z));
  const sMask = 1 - smoothstep(SETTLEMENT_RADIUS * 0.6, SETTLEMENT_RADIUS, sDist);

  const crossingDist = Math.sqrt(dist2(x, z, CROSSING_CENTER.x, CROSSING_CENTER.z));
  const crossingMask = 1 - smoothstep(CROSSING_RADIUS * 0.82, CROSSING_RADIUS, crossingDist);

  const rDist2 = Math.sqrt(dist2(x, z, RUIN_CENTER.x, RUIN_CENTER.z));
  const rMask = 1 - smoothstep(RUIN_RADIUS * 0.5, RUIN_RADIUS, rDist2);

  // Mine apron: the authored door and its return target must share a stable,
  // walkable landing instead of straddling procedural slope noise.
  const mineDist = Math.sqrt(dist2(x, z, MINE_ENTRANCE.x, MINE_ENTRANCE.z));
  const mineMask = 1 - smoothstep(5, 18, mineDist);

  // Road bed: pull height toward a smoothed baseline near the road.
  const roadD = roadDistance(x, z);
  const roadMask = 1 - smoothstep(3, 14, roadD);
  if (roadMask > 0) {
    const base = 6 + fbm2(x * 0.0035, z * 0.0035, seed, 2) * 14;
    const target = Math.max(base, WATER_LEVEL + 1.5);
    h = h * (1 - roadMask * 0.85) + target * roadMask * 0.85;
  }

  // Authored site pads override road deformation throughout their core and
  // feather back into the surrounding heightfield at their established edge.
  h = h * (1 - sMask) + SETTLEMENT_PLATEAU_H * sMask;
  h = h * (1 - crossingMask) + CROSSING_PLATEAU_H * crossingMask;
  h = h * (1 - rMask) + RUIN_PLATEAU_H * rMask;
  h = h * (1 - mineMask) + MINE_ENTRANCE_PLATEAU_H * mineMask;

  // Fine detail everywhere except roadbed/plateaus.
  const detailMask = (1 - roadMask) * (1 - sMask) * (1 - crossingMask) * (1 - rMask) * (1 - mineMask);
  h += (fbm2(x * 0.09, z * 0.09, seed + 31, 3) - 0.5) * 2.2 * detailMask;

  return h;
}

/** Max walkable slope (rise/run). Steeper is a navigation blocker. */
export const MAX_WALK_SLOPE = 1.1;

export function slopeAt(x: number, z: number, seed: number): number {
  const e = 0.75;
  const hx = terrainHeight(x + e, z, seed) - terrainHeight(x - e, z, seed);
  const hz = terrainHeight(x, z + e, seed) - terrainHeight(x, z - e, seed);
  return Math.sqrt(hx * hx + hz * hz) / (2 * e);
}

export type Biome = 'tundra' | 'forest' | 'rock' | 'riverbank' | 'road' | 'settlement';

/** Deterministic biome classification for rendering + decoration scatter. */
export function biomeAt(x: number, z: number, seed: number): Biome {
  if (roadDistance(x, z) < 5) return 'road';
  const sDist = Math.sqrt(dist2(x, z, SETTLEMENT_CENTER.x, SETTLEMENT_CENTER.z));
  if (sDist < SETTLEMENT_RADIUS) return 'settlement';
  const crossingDist = Math.sqrt(dist2(x, z, CROSSING_CENTER.x, CROSSING_CENTER.z));
  if (crossingDist < CROSSING_RADIUS) return 'settlement';
  const h = terrainHeight(x, z, seed);
  if (h < WATER_LEVEL + 1.2) return 'riverbank';
  if (h > 60 || slopeAt(x, z, seed) > 0.9) return 'rock';
  if (fbm2(x * 0.01 + 500, z * 0.01, seed + 77, 3) > 0.52) return 'forest';
  return 'tundra';
}
