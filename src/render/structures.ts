// Props, buildings, doors, containers, and interior room shells: stylized
// procedural geometry from world content data. Data in, meshes out; no
// gameplay decisions here.

import * as THREE from 'three';
import type { ContainerDef, DoorDef, InteriorLayout, PropDef } from '../sim/content/schema';
import { terrainHeight } from '../sim/world/terrain';
import { roomBoundarySegments } from '../sim/world/spaces';
import { PALETTE } from './palette';

const wood = new THREE.MeshLambertMaterial({ color: PALETTE.woodWall });
const woodDark = new THREE.MeshLambertMaterial({ color: PALETTE.woodDark });
const roofMat = new THREE.MeshLambertMaterial({ color: PALETTE.roof });
const stone = new THREE.MeshLambertMaterial({ color: PALETTE.stone });
const ruin = new THREE.MeshLambertMaterial({ color: PALETTE.ruinStone });
const caveRock = new THREE.MeshLambertMaterial({ color: PALETTE.caveRock, side: THREE.BackSide });
const caveFloor = new THREE.MeshLambertMaterial({ color: PALETTE.caveFloor });
const chestMat = new THREE.MeshLambertMaterial({ color: PALETTE.leather });

function groundY(spaceKind: 'exterior' | 'interior', x: number, z: number, seed: number): number {
  return spaceKind === 'exterior' ? terrainHeight(x, z, seed) : 0;
}

/** Build one prop. Buildings get walls + a gabled roof; other kinds get
 * simple stylized primitives. */
export function buildProp(p: PropDef, spaceKind: 'exterior' | 'interior', seed: number): THREE.Group {
  const g = new THREE.Group();
  const y = p.y ?? groundY(spaceKind, p.x, p.z, seed);
  g.position.set(p.x, y, p.z);
  g.rotation.y = p.yaw ?? 0;

  if (p.kind.startsWith('building')) {
    const walls = new THREE.Mesh(new THREE.BoxGeometry(p.sx, p.sy * 0.65, p.sz), wood);
    walls.position.y = p.sy * 0.325;
    const roofH = p.sy * 0.45;
    const roof = new THREE.Mesh(coneRoof(p.sx * 1.15, roofH, p.sz * 1.15), roofMat);
    roof.position.y = p.sy * 0.65 + roofH / 2;
    // Sink the foundation below the shared pad as well as rising above it;
    // this avoids a daylight seam even at terrain triangle boundaries.
    const base = new THREE.Mesh(new THREE.BoxGeometry(p.sx * 1.05, 0.9, p.sz * 1.05), stone);
    base.position.y = 0.1;
    g.add(base, walls, roof);
  } else if (p.kind.startsWith('ruin')) {
    if (p.kind === 'ruin_tower') {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(p.sx * 0.5, p.sx * 0.6, p.sy, 8, 1, true), ruin);
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
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(p.sx * 0.6, p.sx * 0.7, 0.3, 7), stone);
    ring.position.y = 0.15;
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(p.sx * 0.35, 6, 5),
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
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(p.sx * 0.5, p.sx * 0.6, p.sy, 6), stone);
    pillar.position.y = p.sy / 2;
    g.add(pillar);
  } else if (p.kind === 'standing_stone') {
    const monolith = new THREE.Mesh(new THREE.DodecahedronGeometry(0.65, 0), ruin);
    monolith.scale.set(p.sx * 0.65, p.sy * 0.62, p.sz * 0.65);
    monolith.position.y = p.sy * 0.48;
    monolith.rotation.z = 0.05;
    g.add(monolith);
  } else if (p.kind === 'shrine_basin') {
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(p.sx * 0.55, p.sx * 0.72, p.sy, 8), ruin);
    basin.position.y = p.sy / 2;
    const hollow = new THREE.Mesh(
      new THREE.CircleGeometry(p.sx * 0.42, 8),
      new THREE.MeshBasicMaterial({ color: 0x26333a, side: THREE.DoubleSide }),
    );
    hollow.rotation.x = -Math.PI / 2;
    hollow.position.y = p.sy + 0.01;
    g.add(basin, hollow);
  } else if (p.kind === 'root_column') {
    const root = new THREE.Mesh(new THREE.CylinderGeometry(p.sx * 0.35, p.sx * 0.58, p.sy, 6), woodDark);
    root.position.y = p.sy / 2;
    root.rotation.z = 0.08;
    g.add(root);
  } else if (p.kind === 'nest') {
    for (let i = 0; i < 9; i++) {
      const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, p.sx * 0.75, 5), woodDark);
      branch.rotation.set(Math.PI / 2, (i / 9) * Math.PI * 2, (i % 2 ? 1 : -1) * 0.12);
      branch.position.y = 0.18 + (i % 3) * 0.04;
      g.add(branch);
    }
  } else if (p.kind === 'glowcaps') {
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x73d7bd });
    for (let i = 0; i < 5; i++) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 0.35 + i * 0.05, 5), caveFloor);
      stem.position.set((i - 2) * 0.18, 0.18 + i * 0.025, (i % 2 ? 1 : -1) * 0.12);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.13 + (i % 2) * 0.04, 6, 4), glowMat);
      cap.scale.y = 0.45;
      cap.position.set(stem.position.x, stem.position.y * 2 + 0.05, stem.position.z);
      g.add(stem, cap);
    }
    const light = new THREE.PointLight(0x8cebd3, 34, 24);
    light.position.y = 1.2;
    g.add(light);
  } else if (p.kind === 'well') {
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(p.sx * 0.6, p.sx * 0.6, 1, 8, 1, true), stone);
    rim.position.y = 0.35;
    const rimCap = new THREE.Mesh(new THREE.RingGeometry(p.sx * 0.42, p.sx * 0.68, 8), stone);
    rimCap.name = 'well-rim-cap';
    rimCap.rotation.x = -Math.PI / 2;
    rimCap.position.y = 0.85;
    const shaft = new THREE.Mesh(
      new THREE.CircleGeometry(p.sx * 0.42, 8),
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
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.2, 8), woodDark);
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
      new THREE.SphereGeometry(0.25, 6, 5),
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
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.6, 0.3), woodDark);
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
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.7), chestMat);
  body.position.y = 0.35;
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.25, 0.7), woodDark);
  lid.position.y = 0.82;
  g.add(body, lid);
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
