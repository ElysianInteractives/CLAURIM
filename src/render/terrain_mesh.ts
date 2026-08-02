// Streamed exterior terrain: one vertex-colored mesh per cell, built from the
// SAME pure heightfield the sim uses, plus deterministic decoration scatter
// (pines, rocks) from coordinate hashes. Cells build when they enter the
// active radius and dispose when they leave.

import * as THREE from 'three';
import { biomeAt, terrainHeight, WATER_LEVEL } from '../sim/world/terrain';
import { hash2 } from '../sim/rng';
import { CELL_SIZE } from '../sim/world/cells';
import { PALETTE } from './palette';

const SEGMENTS = 32;
export const TREE_TRIES_PER_CELL = 90;

function sharedGeometry<T extends THREE.BufferGeometry>(geometry: T): T {
  geometry.userData.claurimShared = true;
  return geometry;
}

function transformMatrix(
  x: number,
  y: number,
  z: number,
  scaleX: number,
  scaleY = scaleX,
  scaleZ = scaleX,
  yaw = 0,
): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
    new THREE.Vector3(scaleX, scaleY, scaleZ),
  );
}

interface InstancePlacement {
  matrix: THREE.Matrix4;
  color?: number;
}

function addInstances(
  group: THREE.Group,
  name: string,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  placements: readonly InstancePlacement[],
): void {
  if (placements.length === 0) return;
  const mesh = new THREE.InstancedMesh(geometry, material, placements.length);
  mesh.name = name;
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  const color = new THREE.Color();
  for (let i = 0; i < placements.length; i++) {
    const placement = placements[i];
    mesh.setMatrixAt(i, placement.matrix);
    if (placement.color !== undefined) mesh.setColorAt(i, color.setHex(placement.color));
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  group.add(mesh);
}

const BIOME_COLORS: Record<string, number> = {
  tundra: PALETTE.tundra,
  forest: PALETTE.forestFloor,
  rock: PALETTE.rock,
  riverbank: PALETTE.riverbank,
  road: PALETTE.road,
  settlement: PALETTE.settlementGround,
};

export class TerrainStreamer {
  private cells = new Map<string, THREE.Group>();
  private material = new THREE.MeshLambertMaterial({ vertexColors: true });
  private treeTrunkGeoHigh = sharedGeometry(new THREE.CylinderGeometry(0.18, 0.28, 2.2, 12));
  private treeTrunkGeoMedium = sharedGeometry(new THREE.CylinderGeometry(0.18, 0.28, 2.2, 5));
  private treeTopGeoHigh = sharedGeometry(new THREE.ConeGeometry(1, 1, 14));
  private treeTopGeoMedium = sharedGeometry(new THREE.ConeGeometry(1, 1, 6));
  private treeCrownGeoHigh = sharedGeometry(new THREE.ConeGeometry(1, 1, 12));
  private treeCrownGeoMedium = sharedGeometry(new THREE.ConeGeometry(1, 1, 6));
  private rockGeoHigh = sharedGeometry(new THREE.DodecahedronGeometry(0.8, 1));
  private rockGeoMedium = sharedGeometry(new THREE.DodecahedronGeometry(0.8, 0));
  private waterGeo = sharedGeometry(new THREE.PlaneGeometry(CELL_SIZE, CELL_SIZE));
  private trunkMat = new THREE.MeshLambertMaterial({ color: PALETTE.trunk });
  private foliageMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  private rockMat = new THREE.MeshLambertMaterial({ color: PALETTE.rock });
  private waterMat = new THREE.MeshLambertMaterial({
    color: PALETTE.water,
    transparent: true,
    opacity: 0.82,
  });

  constructor(
    private scene: THREE.Scene,
    private seed: number,
  ) {
    this.waterGeo.rotateX(-Math.PI / 2);
  }

  /** Sync built cells with the active set around (px, pz). */
  update(px: number, pz: number, radius: number, highDetailRadius = 1): void {
    const ccx = Math.floor(px / CELL_SIZE);
    const ccz = Math.floor(pz / CELL_SIZE);
    const wanted = new Set<string>();
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const key = `${ccx + dx},${ccz + dz}`;
        wanted.add(key);
        if (!this.cells.has(key)) {
          const group = this.buildCell(ccx + dx, ccz + dz);
          this.cells.set(key, group);
          this.scene.add(group);
        }
        const group = this.cells.get(key)!;
        const high = Math.max(Math.abs(dx), Math.abs(dz)) <= highDetailRadius;
        const highGroup = group.getObjectByName('decoration-high');
        const mediumGroup = group.getObjectByName('decoration-medium');
        if (highGroup) highGroup.visible = high;
        if (mediumGroup) mediumGroup.visible = !high;
      }
    }
    for (const [key, group] of [...this.cells]) {
      if (!wanted.has(key)) {
        this.scene.remove(group);
        disposeGroup(group);
        this.cells.delete(key);
      }
    }
  }

  clear(): void {
    for (const [, group] of this.cells) {
      this.scene.remove(group);
      disposeGroup(group);
    }
    this.cells.clear();
  }

  private buildCell(cx: number, cz: number): THREE.Group {
    const group = new THREE.Group();
    const x0 = cx * CELL_SIZE;
    const z0 = cz * CELL_SIZE;

    const geo = new THREE.PlaneGeometry(CELL_SIZE, CELL_SIZE, SEGMENTS, SEGMENTS);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const wx = x0 + CELL_SIZE / 2 + pos.getX(i);
      const wz = z0 + CELL_SIZE / 2 + pos.getZ(i);
      const h = terrainHeight(wx, wz, this.seed);
      pos.setY(i, h);
      const biome = biomeAt(wx, wz, this.seed);
      let color = BIOME_COLORS[biome] ?? PALETTE.tundra;
      if (h > 70) color = PALETTE.rockHigh;
      else if (h > 46 && biome !== 'road') color = PALETTE.tundraSnow;
      c.setHex(color);
      // Slight deterministic tonal variation for a painterly ground.
      const v = 0.92 + hash2(Math.round(wx * 3), Math.round(wz * 3), this.seed + 5) * 0.16;
      colors[i * 3] = c.r * v;
      colors[i * 3 + 1] = c.g * v;
      colors[i * 3 + 2] = c.b * v;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, this.material);
    // PlaneGeometry vertices are local around origin; reposition accordingly.
    mesh.position.set(x0 + CELL_SIZE / 2, 0, z0 + CELL_SIZE / 2);
    group.add(mesh);

    // Water tile if any part of the cell is below water level.
    let hasWater = false;
    for (let i = 0; i < pos.count; i += 7) {
      if (pos.getY(i) < WATER_LEVEL + 0.4) {
        hasWater = true;
        break;
      }
    }
    if (hasWater) {
      const water = new THREE.Mesh(this.waterGeo, this.waterMat);
      water.position.set(x0 + CELL_SIZE / 2, WATER_LEVEL, z0 + CELL_SIZE / 2);
      group.add(water);
    }

    // Deterministic decoration scatter: pines in forest, rocks on rock biome.
    const trunks: InstancePlacement[] = [];
    const tops: InstancePlacement[] = [];
    const crowns: InstancePlacement[] = [];
    const rocks: InstancePlacement[] = [];
    for (let i = 0; i < TREE_TRIES_PER_CELL; i++) {
      const hx = hash2(cx * 131 + i, cz * 197, this.seed + 11);
      const hz = hash2(cx * 131 + i, cz * 197, this.seed + 23);
      const wx = x0 + hx * CELL_SIZE;
      const wz = z0 + hz * CELL_SIZE;
      const biome = biomeAt(wx, wz, this.seed);
      const h = terrainHeight(wx, wz, this.seed);
      if (biome === 'forest' && h > WATER_LEVEL + 1) {
        const scale = 0.8 + hash2(i, cx + cz, this.seed + 31) * 0.8;
        trunks.push({ matrix: transformMatrix(wx, h + 1.1 * scale, wz, scale) });
        const tall = hash2(i, cx, this.seed + 47) > 0.55;
        const lightTop = hash2(i, cz, this.seed) > 0.5;
        const darkCrown = hash2(i, cz, this.seed + 53) > 0.5;
        tops.push({
          matrix: transformMatrix(
            wx,
            h + (2.2 + (tall ? 2.6 : 2.1)) * scale,
            wz,
            (tall ? 1.25 : 1.5) * scale,
            (tall ? 5.2 : 4.2) * scale,
            (tall ? 1.25 : 1.5) * scale,
          ),
          color: lightTop ? PALETTE.pine : PALETTE.pineDark,
        });
        crowns.push({
          matrix: transformMatrix(
            wx,
            h + (tall ? 6.4 : 5.4) * scale,
            wz,
            (tall ? 0.9 : 1.05) * scale,
            (tall ? 3.2 : 2.7) * scale,
            (tall ? 0.9 : 1.05) * scale,
          ),
          color: darkCrown ? PALETTE.pineDark : PALETTE.pine,
        });
      } else if (biome === 'rock' && i % 5 === 0 && h > WATER_LEVEL) {
        const scale = 0.6 + hash2(i, cx - cz, this.seed + 41) * 1.6;
        const yaw = hash2(i, cz - cx, this.seed + 43) * Math.PI;
        rocks.push({ matrix: transformMatrix(wx, h + 0.3 * scale, wz, scale, scale, scale, yaw) });
      }
    }
    const high = new THREE.Group();
    high.name = 'decoration-high';
    addInstances(high, 'tree-trunks-high', this.treeTrunkGeoHigh, this.trunkMat, trunks);
    addInstances(high, 'tree-tops-high', this.treeTopGeoHigh, this.foliageMat, tops);
    addInstances(high, 'tree-crowns-high', this.treeCrownGeoHigh, this.foliageMat, crowns);
    addInstances(high, 'rocks-high', this.rockGeoHigh, this.rockMat, rocks);
    const medium = new THREE.Group();
    medium.name = 'decoration-medium';
    addInstances(medium, 'tree-trunks-medium', this.treeTrunkGeoMedium, this.trunkMat, trunks);
    addInstances(medium, 'tree-tops-medium', this.treeTopGeoMedium, this.foliageMat, tops);
    addInstances(medium, 'tree-crowns-medium', this.treeCrownGeoMedium, this.foliageMat, crowns);
    addInstances(medium, 'rocks-medium', this.rockGeoMedium, this.rockMat, rocks);
    group.add(high, medium);
    return group;
  }
}

export function disposeGroup(group: THREE.Group): void {
  const disposable = new Set<THREE.BufferGeometry>();
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh && mesh.geometry?.userData.claurimShared !== true) disposable.add(mesh.geometry);
  });
  for (const geometry of disposable) geometry.dispose();
}
