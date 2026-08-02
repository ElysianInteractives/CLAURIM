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
  scale: number,
  yaw = 0,
): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
    new THREE.Vector3(scale, scale, scale),
  );
}

function addInstances(
  group: THREE.Group,
  name: string,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  matrices: readonly THREE.Matrix4[],
): void {
  if (matrices.length === 0) return;
  const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
  mesh.name = name;
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  for (let i = 0; i < matrices.length; i++) mesh.setMatrixAt(i, matrices[i]);
  mesh.instanceMatrix.needsUpdate = true;
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
  private treeTrunkGeo = sharedGeometry(new THREE.CylinderGeometry(0.18, 0.28, 2.2, 5));
  private treeTopGeo = sharedGeometry(new THREE.ConeGeometry(1.5, 4.2, 6));
  private treeTopTallGeo = sharedGeometry(new THREE.ConeGeometry(1.25, 5.2, 7));
  private treeCrownGeo = sharedGeometry(new THREE.ConeGeometry(1.05, 2.7, 6));
  private treeCrownTallGeo = sharedGeometry(new THREE.ConeGeometry(0.9, 3.2, 6));
  private rockGeo = sharedGeometry(new THREE.DodecahedronGeometry(0.8, 0));
  private waterGeo = sharedGeometry(new THREE.PlaneGeometry(CELL_SIZE, CELL_SIZE));
  private trunkMat = new THREE.MeshLambertMaterial({ color: PALETTE.trunk });
  private pineMat = new THREE.MeshLambertMaterial({ color: PALETTE.pine });
  private pineDarkMat = new THREE.MeshLambertMaterial({ color: PALETTE.pineDark });
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
  update(px: number, pz: number, radius: number): void {
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
    const trunks: THREE.Matrix4[] = [];
    const shortPineTops: THREE.Matrix4[] = [];
    const shortDarkTops: THREE.Matrix4[] = [];
    const tallPineTops: THREE.Matrix4[] = [];
    const tallDarkTops: THREE.Matrix4[] = [];
    const shortPineCrowns: THREE.Matrix4[] = [];
    const shortDarkCrowns: THREE.Matrix4[] = [];
    const tallPineCrowns: THREE.Matrix4[] = [];
    const tallDarkCrowns: THREE.Matrix4[] = [];
    const rocks: THREE.Matrix4[] = [];
    for (let i = 0; i < TREE_TRIES_PER_CELL; i++) {
      const hx = hash2(cx * 131 + i, cz * 197, this.seed + 11);
      const hz = hash2(cx * 131 + i, cz * 197, this.seed + 23);
      const wx = x0 + hx * CELL_SIZE;
      const wz = z0 + hz * CELL_SIZE;
      const biome = biomeAt(wx, wz, this.seed);
      const h = terrainHeight(wx, wz, this.seed);
      if (biome === 'forest' && h > WATER_LEVEL + 1) {
        const scale = 0.8 + hash2(i, cx + cz, this.seed + 31) * 0.8;
        trunks.push(transformMatrix(wx, h + 1.1 * scale, wz, scale));
        const tall = hash2(i, cx, this.seed + 47) > 0.55;
        const topMatrix = transformMatrix(
          wx,
          h + (2.2 + (tall ? 2.6 : 2.1)) * scale,
          wz,
          scale,
        );
        const crownMatrix = transformMatrix(wx, h + (tall ? 6.4 : 5.4) * scale, wz, scale);
        const lightTop = hash2(i, cz, this.seed) > 0.5;
        const darkCrown = hash2(i, cz, this.seed + 53) > 0.5;
        if (tall) {
          (lightTop ? tallPineTops : tallDarkTops).push(topMatrix);
          (darkCrown ? tallDarkCrowns : tallPineCrowns).push(crownMatrix);
        } else {
          (lightTop ? shortPineTops : shortDarkTops).push(topMatrix);
          (darkCrown ? shortDarkCrowns : shortPineCrowns).push(crownMatrix);
        }
      } else if (biome === 'rock' && i % 5 === 0 && h > WATER_LEVEL) {
        const scale = 0.6 + hash2(i, cx - cz, this.seed + 41) * 1.6;
        const yaw = hash2(i, cz - cx, this.seed + 43) * Math.PI;
        rocks.push(transformMatrix(wx, h + 0.3 * scale, wz, scale, yaw));
      }
    }
    addInstances(group, 'tree-trunks', this.treeTrunkGeo, this.trunkMat, trunks);
    addInstances(group, 'tree-tops-short-pine', this.treeTopGeo, this.pineMat, shortPineTops);
    addInstances(group, 'tree-tops-short-dark', this.treeTopGeo, this.pineDarkMat, shortDarkTops);
    addInstances(group, 'tree-tops-tall-pine', this.treeTopTallGeo, this.pineMat, tallPineTops);
    addInstances(group, 'tree-tops-tall-dark', this.treeTopTallGeo, this.pineDarkMat, tallDarkTops);
    addInstances(group, 'tree-crowns-short-pine', this.treeCrownGeo, this.pineMat, shortPineCrowns);
    addInstances(group, 'tree-crowns-short-dark', this.treeCrownGeo, this.pineDarkMat, shortDarkCrowns);
    addInstances(group, 'tree-crowns-tall-pine', this.treeCrownTallGeo, this.pineMat, tallPineCrowns);
    addInstances(group, 'tree-crowns-tall-dark', this.treeCrownTallGeo, this.pineDarkMat, tallDarkCrowns);
    addInstances(group, 'rocks', this.rockGeo, this.rockMat, rocks);
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
