// Props, buildings, doors, containers, and interior room shells: stylized
// procedural geometry from world content data. Data in, meshes out; no
// gameplay decisions here.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ContainerDef, DoorDef, InteriorLayout, PropDef } from '../sim/content/schema';
import { terrainHeight } from '../sim/world/terrain';
import { roomBoundarySegments } from '../sim/world/spaces';
import { PALETTE } from './palette';

const wood = new THREE.MeshStandardMaterial({ color: PALETTE.woodWall, roughness: 0.88 });
const woodDark = new THREE.MeshStandardMaterial({ color: PALETTE.woodDark, roughness: 0.82 });
const roofMat = new THREE.MeshStandardMaterial({ color: PALETTE.roof, roughness: 0.9 });
const stone = new THREE.MeshStandardMaterial({ color: PALETTE.stone, roughness: 0.96 });
const ruin = new THREE.MeshStandardMaterial({ color: PALETTE.ruinStone, roughness: 0.97 });
const caveRock = new THREE.MeshStandardMaterial({ color: PALETTE.caveRock, roughness: 1, side: THREE.BackSide });
const caveFloor = new THREE.MeshStandardMaterial({ color: PALETTE.caveFloor, roughness: 1 });
const chestMat = new THREE.MeshStandardMaterial({ color: PALETTE.leather, roughness: 0.8 });
const windowMat = new THREE.MeshStandardMaterial({ color: 0x253641, roughness: 0.2, metalness: 0.15 });

export const BUILDING_HIGH_DETAIL_DISTANCE = 55;
export const BUILDING_PRESSURE_DETAIL_DISTANCE = 28;

function groundY(spaceKind: 'exterior' | 'interior', x: number, z: number, seed: number): number {
  return spaceKind === 'exterior' ? terrainHeight(x, z, seed) : 0;
}

interface RoundedPart {
  sx: number;
  sy: number;
  sz: number;
  x: number;
  y: number;
  z: number;
  rz?: number;
}

function mergedRoundedParts(
  parts: readonly RoundedPart[],
  radius: number,
  segments = 3,
): THREE.BufferGeometry {
  const geometries = parts.map((part) => {
    const geometry = new RoundedBoxGeometry(part.sx, part.sy, part.sz, segments, radius);
    geometry.applyMatrix4(new THREE.Matrix4().compose(
      new THREE.Vector3(part.x, part.y, part.z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), part.rz ?? 0),
      new THREE.Vector3(1, 1, 1),
    ));
    return geometry;
  });
  const merged = mergeGeometries(geometries, false);
  for (const geometry of geometries) geometry.dispose();
  if (!merged) throw new Error('building detail geometry could not be merged');
  return merged;
}

function mergedBoxParts(parts: readonly RoundedPart[]): THREE.BufferGeometry {
  const geometries = parts.map((part) => {
    const geometry = new THREE.BoxGeometry(part.sx, part.sy, part.sz);
    geometry.applyMatrix4(new THREE.Matrix4().compose(
      new THREE.Vector3(part.x, part.y, part.z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), part.rz ?? 0),
      new THREE.Vector3(1, 1, 1),
    ));
    return geometry;
  });
  const merged = mergeGeometries(geometries, false);
  for (const geometry of geometries) geometry.dispose();
  if (!merged) throw new Error('building trim geometry could not be merged');
  return merged;
}

function buildBuildingLevel(p: PropDef, highDetail: boolean): THREE.Group {
  const level = new THREE.Group();
  level.name = highDetail ? 'building-high' : 'building-medium';
  const wallH = p.sy * 0.65;
  const roofH = p.sy * 0.45;
  if (!highDetail) {
    const walls = new THREE.Mesh(new THREE.BoxGeometry(p.sx, wallH, p.sz), wood);
    walls.position.y = wallH / 2;
    const roof = new THREE.Mesh(coneRoof(p.sx * 1.15, roofH, p.sz * 1.15), roofMat);
    roof.position.y = wallH + roofH / 2;
    const base = new THREE.Mesh(new THREE.BoxGeometry(p.sx * 1.05, 0.9, p.sz * 1.05), stone);
    base.position.y = 0.1;
    level.add(base, walls, roof);
    return level;
  }

  // Broad silhouettes retain rounded high-detail surfaces. Narrow trim uses
  // merged boxes: sub-centimetre bevel tessellation is invisible at the
  // gameplay camera but previously consumed most of each building's GPU
  // budget (Find7).
  const walls = new THREE.Mesh(new RoundedBoxGeometry(p.sx, wallH, p.sz, 3, 0.12), wood);
  walls.position.y = wallH / 2;
  const base = new THREE.Mesh(new RoundedBoxGeometry(p.sx * 1.05, 0.9, p.sz * 1.05, 2, 0.1), stone);
  base.position.y = 0.1;

  const roofWidth = p.sx * 1.15;
  const roofDepth = p.sz * 1.18;
  const halfRoof = roofWidth / 2;
  const slope = Math.hypot(halfRoof, roofH);
  const roofAngle = Math.atan2(roofH, halfRoof);
  const roof = new THREE.Mesh(mergedRoundedParts([
    { sx: slope + 0.2, sy: 0.18, sz: roofDepth, x: -halfRoof / 2, y: wallH + roofH / 2, z: 0, rz: roofAngle },
    { sx: slope + 0.2, sy: 0.18, sz: roofDepth, x: halfRoof / 2, y: wallH + roofH / 2, z: 0, rz: -roofAngle },
  ], 0.045, 2), roofMat);

  const beam = Math.max(0.14, Math.min(0.24, p.sx * 0.025));
  const trimParts: RoundedPart[] = [];
  for (const x of [-p.sx * 0.47, p.sx * 0.47]) {
    for (const z of [-p.sz * 0.47, p.sz * 0.47]) {
      trimParts.push({ sx: beam, sy: wallH + 0.12, sz: beam, x, y: wallH / 2, z });
    }
  }
  trimParts.push(
    { sx: p.sx * 0.94, sy: beam, sz: beam, x: 0, y: wallH * 0.48, z: p.sz * 0.505 },
    { sx: p.sx * 0.94, sy: beam, sz: beam, x: 0, y: wallH * 0.48, z: -p.sz * 0.505 },
  );

  const paneWidth = Math.max(0.55, Math.min(1, p.sx * 0.12));
  const paneHeight = Math.max(0.7, Math.min(1.2, wallH * 0.28));
  const panes: RoundedPart[] = [];
  for (const x of [-p.sx * 0.24, p.sx * 0.24]) {
    panes.push({ sx: paneWidth, sy: paneHeight, sz: 0.055, x, y: wallH * 0.58, z: p.sz / 2 + 0.055 });
    trimParts.push(
      { sx: paneWidth + 0.14, sy: 0.07, sz: 0.08, x, y: wallH * 0.58 - paneHeight / 2, z: p.sz / 2 + 0.08 },
      { sx: paneWidth + 0.14, sy: 0.07, sz: 0.08, x, y: wallH * 0.58 + paneHeight / 2, z: p.sz / 2 + 0.08 },
      { sx: 0.07, sy: paneHeight, sz: 0.08, x: x - paneWidth / 2, y: wallH * 0.58, z: p.sz / 2 + 0.08 },
      { sx: 0.07, sy: paneHeight, sz: 0.08, x: x + paneWidth / 2, y: wallH * 0.58, z: p.sz / 2 + 0.08 },
    );
  }
  const trim = new THREE.Mesh(mergedBoxParts(trimParts), woodDark);
  const windows = new THREE.Mesh(mergedRoundedParts(panes, 0.02, 1), windowMat);
  const chimney = new THREE.Mesh(new RoundedBoxGeometry(0.55, 1.4, 0.55, 2, 0.06), stone);
  chimney.position.set(p.sx * 0.28, wallH + roofH * 0.72, 0);
  level.add(base, walls, roof, trim, windows, chimney);
  return level;
}

/** Build one prop. Buildings get walls + a gabled roof; other kinds get
 * simple stylized primitives. */
export function buildProp(p: PropDef, spaceKind: 'exterior' | 'interior', seed: number): THREE.Group {
  const g = new THREE.Group();
  const y = p.y ?? groundY(spaceKind, p.x, p.z, seed);
  g.position.set(p.x, y, p.z);
  g.rotation.y = p.yaw ?? 0;

  if (p.kind.startsWith('building')) {
    const lod = new THREE.LOD();
    lod.name = 'building-lod';
    lod.addLevel(buildBuildingLevel(p, true), 0);
    lod.addLevel(buildBuildingLevel(p, false), BUILDING_HIGH_DETAIL_DISTANCE, 0.15);
    g.add(lod);
  } else if (p.kind.startsWith('ruin')) {
    if (p.kind === 'ruin_tower') {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(p.sx * 0.5, p.sx * 0.6, p.sy, 18, 1, true), ruin);
      tower.position.y = p.sy / 2;
      // Broken crown: a few crenel blocks.
      for (let i = 0; i < 5; i++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 1), ruin);
        const ang = (i / 5) * Math.PI * 1.4;
        b.position.set(Math.cos(ang) * p.sx * 0.5, p.sy + 0.5, Math.sin(ang) * p.sx * 0.5);
        g.add(b);
      }
      g.add(tower);
    } else if (p.kind === 'ruin_arch') {
      const l = new THREE.Mesh(new THREE.BoxGeometry(1, p.sy, 1.2), ruin);
      l.position.set(-p.sx / 2, p.sy / 2, 0);
      const r = l.clone();
      r.position.x = p.sx / 2;
      const top = new THREE.Mesh(new THREE.BoxGeometry(p.sx + 1, 1, 1.2), ruin);
      top.position.y = p.sy;
      g.add(l, r, top);
    } else {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(p.sx, p.sy, p.sz), ruin);
      wall.position.y = p.sy / 2;
      g.add(wall);
    }
  } else if (p.kind === 'tent') {
    const tent = new THREE.Mesh(coneRoof(p.sx, p.sy, p.sz), new THREE.MeshLambertMaterial({ color: PALETTE.clothRed }));
    tent.position.y = p.sy / 2;
    g.add(tent);
  } else if (p.kind === 'campfire' || p.kind === 'forge' || p.kind === 'hearth') {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(p.sx * 0.6, p.sx * 0.7, 0.3, 16), stone);
    ring.position.y = 0.15;
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(p.sx * 0.35, 16, 10),
      new THREE.MeshBasicMaterial({ color: PALETTE.ember }),
    );
    glow.position.y = 0.35;
    const light = new THREE.PointLight(PALETTE.torch, 30, 18);
    light.position.y = 1.2;
    g.add(ring, glow, light);
  } else if (p.kind === 'mine_entrance') {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.8, p.sy, 0.8), woodDark);
    l.position.set(-p.sx / 2 + 0.4, p.sy / 2, 0);
    const r = l.clone();
    r.position.x = p.sx / 2 - 0.4;
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(p.sx, 0.8, 1), woodDark);
    lintel.position.y = p.sy - 0.4;
    const dark = new THREE.Mesh(
      new THREE.PlaneGeometry(p.sx - 1.4, p.sy - 0.8),
      new THREE.MeshBasicMaterial({ color: 0x050505 }),
    );
    dark.position.set(0, (p.sy - 0.8) / 2, -0.3);
    g.add(l, r, lintel, dark);
  } else if (p.kind === 'pillar') {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(p.sx * 0.5, p.sx * 0.6, p.sy, 16), stone);
    pillar.position.y = p.sy / 2;
    g.add(pillar);
  } else if (p.kind === 'standing_stone') {
    const monolith = new THREE.Mesh(new THREE.DodecahedronGeometry(0.65, 1), ruin);
    monolith.scale.set(p.sx * 0.65, p.sy * 0.62, p.sz * 0.65);
    monolith.position.y = p.sy * 0.48;
    monolith.rotation.z = 0.05;
    g.add(monolith);
  } else if (p.kind === 'shrine_basin') {
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(p.sx * 0.55, p.sx * 0.72, p.sy, 18), ruin);
    basin.position.y = p.sy / 2;
    const hollow = new THREE.Mesh(
      new THREE.CircleGeometry(p.sx * 0.42, 24),
      new THREE.MeshBasicMaterial({ color: 0x26333a, side: THREE.DoubleSide }),
    );
    hollow.rotation.x = -Math.PI / 2;
    hollow.position.y = p.sy + 0.01;
    g.add(basin, hollow);
  } else if (p.kind === 'root_column') {
    const root = new THREE.Mesh(new THREE.CylinderGeometry(p.sx * 0.35, p.sx * 0.58, p.sy, 16), woodDark);
    root.position.y = p.sy / 2;
    root.rotation.z = 0.08;
    g.add(root);
  } else if (p.kind === 'nest') {
    for (let i = 0; i < 9; i++) {
      const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, p.sx * 0.75, 10), woodDark);
      branch.rotation.set(Math.PI / 2, (i / 9) * Math.PI * 2, (i % 2 ? 1 : -1) * 0.12);
      branch.position.y = 0.18 + (i % 3) * 0.04;
      g.add(branch);
    }
  } else if (p.kind === 'glowcaps') {
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x73d7bd });
    for (let i = 0; i < 5; i++) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 0.35 + i * 0.05, 12), caveFloor);
      stem.position.set((i - 2) * 0.18, 0.18 + i * 0.025, (i % 2 ? 1 : -1) * 0.12);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.13 + (i % 2) * 0.04, 14, 8), glowMat);
      cap.scale.y = 0.45;
      cap.position.set(stem.position.x, stem.position.y * 2 + 0.05, stem.position.z);
      g.add(stem, cap);
    }
    const light = new THREE.PointLight(0x8cebd3, 34, 24);
    light.position.y = 1.2;
    g.add(light);
  } else if (p.kind === 'well') {
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(p.sx * 0.6, p.sx * 0.6, 1, 20, 1, true), stone);
    rim.position.y = 0.35;
    const rimCap = new THREE.Mesh(new THREE.RingGeometry(p.sx * 0.42, p.sx * 0.68, 24), stone);
    rimCap.name = 'well-rim-cap';
    rimCap.rotation.x = -Math.PI / 2;
    rimCap.position.y = 0.85;
    const shaft = new THREE.Mesh(
      new THREE.CircleGeometry(p.sx * 0.42, 24),
      new THREE.MeshBasicMaterial({ color: 0x080a0c, side: THREE.DoubleSide }),
    );
    shaft.name = 'well-shaft';
    shaft.rotation.x = -Math.PI / 2;
    shaft.position.y = 0.82;
    const roofPole = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.2, 0.2), woodDark);
    roofPole.position.set(p.sx * 0.5, 1.1, 0);
    const roofPole2 = roofPole.clone();
    roofPole2.position.x = -p.sx * 0.5;
    const wellRoof = new THREE.Mesh(coneRoof(p.sx * 1.4, 0.8, p.sx * 1.4), roofMat);
    wellRoof.position.y = 2.6;
    g.add(rim, rimCap, shaft, roofPole, roofPole2, wellRoof);
  } else if (p.kind === 'cart') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(p.sx, 0.5, p.sz), wood);
    bed.position.y = 0.8;
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.2, 18), woodDark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(0, 0.5, p.sz / 2);
    const wheel2 = wheel.clone();
    wheel2.position.z = -p.sz / 2;
    g.add(bed, wheel, wheel2);
  } else if (p.kind === 'table' || p.kind === 'bar_counter') {
    const top = new THREE.Mesh(new THREE.BoxGeometry(p.sx, 0.15, p.sz), woodDark);
    top.position.y = p.sy;
    const leg = new THREE.Mesh(new THREE.BoxGeometry(p.sx * 0.9, p.sy, p.sz * 0.2), wood);
    leg.position.y = p.sy / 2;
    g.add(top, leg);
  } else if (p.kind === 'barrow_slab') {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(p.sx, p.sy, p.sz), ruin);
    slab.position.y = p.sy / 2;
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 16, 10),
      new THREE.MeshBasicMaterial({ color: PALETTE.wightGlow }),
    );
    glow.position.y = p.sy + 0.3;
    g.add(slab, glow);
  } else {
    const box = new THREE.Mesh(new THREE.BoxGeometry(p.sx, p.sy, p.sz), wood);
    box.position.y = p.sy / 2;
    g.add(box);
  }
  return g;
}

/** Changes only the visual distance band; authored transforms and colliders
 * are independent of the render LOD. */
export function setBuildingPerformanceDetail(root: THREE.Object3D, enabled: boolean): void {
  root.traverse((object) => {
    if (!(object instanceof THREE.LOD) || object.name !== 'building-lod') return;
    const medium = object.levels[1];
    if (medium) {
      medium.distance = enabled
        ? BUILDING_PRESSURE_DETAIL_DISTANCE
        : BUILDING_HIGH_DETAIL_DISTANCE;
    }
  });
}

function coneRoof(sx: number, h: number, sz: number): THREE.BufferGeometry {
  // A simple gable: stretched pyramid.
  const geo = new THREE.ConeGeometry(0.5, 1, 4);
  geo.rotateY(Math.PI / 4);
  geo.scale(sx * 0.72, h, sz * 0.72);
  return geo;
}

export function buildDoorMarker(d: DoorDef, spaceKind: 'exterior' | 'interior', seed: number): THREE.Group {
  const g = new THREE.Group();
  const y = groundY(spaceKind, d.x, d.z, seed);
  g.position.set(d.x, y, d.z);
  g.rotation.y = d.yaw ?? 0;
  const frame = new THREE.Mesh(new RoundedBoxGeometry(1.6, 2.6, 0.3, 3, 0.06), woodDark);
  frame.position.y = 1.3;
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 2.2),
    new THREE.MeshBasicMaterial({ color: 0x2a1f16, side: THREE.DoubleSide }),
  );
  panel.position.set(0, 1.2, 0.17);
  g.add(frame, panel);
  return g;
}

export function buildContainerMesh(c: ContainerDef, spaceKind: 'exterior' | 'interior', seed: number): THREE.Group {
  const g = new THREE.Group();
  const y = groundY(spaceKind, c.x, c.z, seed);
  g.position.set(c.x, y, c.z);
  const body = new THREE.Mesh(new RoundedBoxGeometry(1.1, 0.7, 0.7, 3, 0.07), chestMat);
  body.position.y = 0.35;
  const lid = new THREE.Mesh(new RoundedBoxGeometry(1.1, 0.25, 0.7, 3, 0.08), woodDark);
  lid.position.y = 0.82;
  const bandGeometry = mergedRoundedParts([
    { sx: 0.08, sy: 0.94, sz: 0.76, x: -0.35, y: 0.47, z: 0 },
    { sx: 0.08, sy: 0.94, sz: 0.76, x: 0.35, y: 0.47, z: 0 },
  ], 0.025);
  const bands = new THREE.Mesh(bandGeometry, stone);
  g.add(body, lid, bands);
  return g;
}

/** Interior shell: floors, wall slabs around each room edge, torch lights. */
export function buildInteriorShell(layout: InteriorLayout, isMine: boolean): THREE.Group {
  const g = new THREE.Group();
  const wallMat = isMine ? new THREE.MeshLambertMaterial({ color: PALETTE.caveRock }) : wood;
  const floorMat = isMine ? caveFloor : new THREE.MeshLambertMaterial({ color: PALETTE.woodDark });
  for (const r of layout.rooms) {
    const w = r.x1 - r.x0;
    const d = r.z1 - r.z0;
    const floor = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 0.2, d + 1), floorMat);
    floor.position.set((r.x0 + r.x1) / 2, -0.1, (r.z0 + r.z1) / 2);
    g.add(floor);
    const ceil = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 0.2, d + 1), wallMat);
    ceil.position.set((r.x0 + r.x1) / 2, layout.ceilingY, (r.z0 + r.z1) / 2);
    g.add(ceil);
    // A torch light per room.
    const torch = new THREE.PointLight(PALETTE.torch, isMine ? 45 : 25, Math.max(w, d) * 1.6);
    torch.position.set((r.x0 + r.x1) / 2, layout.ceilingY - 0.8, (r.z0 + r.z1) / 2);
    g.add(torch);
  }
  for (const segment of roomBoundarySegments(layout)) {
    const length = segment.to - segment.from;
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(
        segment.axis === 'x' ? length : 0.5,
        layout.ceilingY,
        segment.axis === 'z' ? length : 0.5,
      ),
      wallMat,
    );
    if (segment.axis === 'x') {
      wall.position.set((segment.from + segment.to) / 2, layout.ceilingY / 2, segment.fixed);
    } else {
      wall.position.set(segment.fixed, layout.ceilingY / 2, (segment.from + segment.to) / 2);
    }
    g.add(wall);
  }
  return g;
}
