import * as THREE from 'three';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { loadAssetManifest } from '../scripts/lib/asset_validation';
import {
  ENVIRONMENT_ASSET_CATALOG,
  ENVIRONMENT_HIGH_DETAIL_DISTANCE,
  EnvironmentAssetRuntime,
  applyEnvironmentPropTransform,
  compileEnvironmentModelAsset,
  environmentAssetForProp,
  setEnvironmentPerformanceDetail,
} from '../src/render/environment_assets';

type CatalogEntry = (typeof ENVIRONMENT_ASSET_CATALOG)[keyof typeof ENVIRONMENT_ASSET_CATALOG];

function triangleMesh(name: string, triangles: number): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(triangles * 9), 3));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
  mesh.name = name;
  return mesh;
}

function validScene(entry: CatalogEntry): THREE.Group {
  const scene = new THREE.Group();
  const root = new THREE.Group();
  root.name = entry.rootNode;
  const high = new THREE.Group();
  high.name = entry.lods[0].node;
  high.add(triangleMesh('high-visual', 12));
  const medium = new THREE.Group();
  medium.name = entry.lods[1].node;
  medium.add(triangleMesh('medium-visual', 3));
  const collider = new THREE.Object3D();
  collider.name = entry.colliderNode;
  root.add(high, medium, collider);
  scene.add(root);
  return scene;
}

describe('Asset Phase A1 environment runtime', () => {
  it('keeps the browser catalog aligned with the authored manifest', () => {
    const manifest = loadAssetManifest(process.cwd());
    expect(Object.keys(ENVIRONMENT_ASSET_CATALOG)).toEqual(manifest.assets.map((asset) => asset.id));
    for (const authored of manifest.assets) {
      const runtime = ENVIRONMENT_ASSET_CATALOG[authored.id as keyof typeof ENVIRONMENT_ASSET_CATALOG];
      expect(runtime).toBeDefined();
      expect(runtime.path).toBe(authored.export.replace(/^public\//, ''));
      expect(runtime.rootNode).toBe(authored.rootNode);
      expect(runtime.dimensionsMeters).toEqual(authored.dimensionsMeters);
      expect(runtime.colliderNode).toBe(authored.collider.node);
      expect(runtime.lods).toEqual(authored.lods.map((lod) => ({
        name: lod.name,
        node: lod.node,
        maxTriangles: lod.maxTriangles,
      })));
    }
  });

  it('ships the Basis transcoder and its license note for KTX2 delivery', () => {
    for (const file of ['basis_transcoder.js', 'basis_transcoder.wasm', 'README.md']) {
      expect(existsSync(resolve(process.cwd(), 'public/assets/basis', file)), file).toBe(true);
    }
  });

  it('maps only the Falkmoor pilot prop kinds to live assets', () => {
    expect(environmentAssetForProp({ kind: 'ruin_tower' })).toBe('falkmoor_ruin_tower_a');
    expect(environmentAssetForProp({ kind: 'ruin_wall' })).toBe('falkmoor_ruin_wall_a');
    expect(environmentAssetForProp({ kind: 'ruin_arch' })).toBe('falkmoor_ruin_arch_a');
    expect(environmentAssetForProp({ kind: 'building_house' })).toBeNull();
  });

  it('builds visual-only LOD instances and excludes authored collider metadata', () => {
    const entry = ENVIRONMENT_ASSET_CATALOG.falkmoor_ruin_tower_a;
    const asset = compileEnvironmentModelAsset(entry, validScene(entry));
    const first = asset.instantiate();
    const second = asset.instantiate();
    const lod = first.getObjectByName('environment-asset-lod') as THREE.LOD;

    expect(asset.triangles).toEqual({ LOD0: 12, LOD1: 3 });
    expect(lod).toBeInstanceOf(THREE.LOD);
    expect(lod.levels.map((level) => level.distance)).toEqual([0, ENVIRONMENT_HIGH_DETAIL_DISTANCE]);
    expect(first.getObjectByName(entry.colliderNode)).toBeUndefined();
    const firstGeometry = (first.getObjectByName('high-visual') as THREE.Mesh).geometry;
    const secondGeometry = (second.getObjectByName('high-visual') as THREE.Mesh).geometry;
    expect(firstGeometry).toBe(secondGeometry);
    expect(firstGeometry.userData.claurimShared).toBe(true);

    setEnvironmentPerformanceDetail(first, true);
    expect(lod.levels[1].distance).toBe(28);
  });

  it('coalesces loads, cache-busts an invalidation, and keeps failures recoverable', async () => {
    const entry = ENVIRONMENT_ASSET_CATALOG.falkmoor_ruin_wall_a;
    const loadScene = vi.fn(async () => validScene(entry));
    const runtime = new EnvironmentAssetRuntime({ baseUrl: '/CLAURIM/', loadScene });

    const [first, second] = await Promise.all([
      runtime.instantiate(entry.id),
      runtime.instantiate(entry.id),
    ]);
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(first).not.toBe(second);
    expect(loadScene).toHaveBeenCalledTimes(1);
    expect(loadScene).toHaveBeenLastCalledWith(`/CLAURIM/${entry.path}`);
    expect(runtime.diagnostics()).toEqual({ pending: 0, ready: 1, failed: 0 });

    runtime.invalidate();
    await runtime.instantiate(entry.id);
    expect(loadScene).toHaveBeenCalledTimes(2);
    expect(loadScene).toHaveBeenLastCalledWith(`/CLAURIM/${entry.path}?claurim_asset_revision=1`);

    const onError = vi.fn();
    const failed = new EnvironmentAssetRuntime({
      loadScene: async () => { throw new Error('unavailable'); },
      onError,
    });
    await expect(failed.instantiate('falkmoor_ruin_arch_a')).resolves.toBeNull();
    expect(failed.diagnostics()).toEqual({ pending: 0, ready: 0, failed: 1 });
    expect(onError).toHaveBeenCalledOnce();
  });

  it('applies content placement and scaling without consuming collider metadata', () => {
    const entry = ENVIRONMENT_ASSET_CATALOG.falkmoor_ruin_wall_a;
    const instance = compileEnvironmentModelAsset(entry, validScene(entry)).instantiate();
    applyEnvironmentPropTransform(instance, {
      id: 'ruin_wall_b',
      x: 52,
      z: -414,
      yaw: -0.5,
      sx: 8,
      sy: 2.5,
      sz: 1.5,
    }, entry, 4.25);

    expect(instance.position.toArray()).toEqual([52, 4.25, -414]);
    expect(instance.rotation.y).toBeCloseTo(-0.5);
    expect(instance.scale.toArray()).toEqual([0.8, 2.5 / 3, 1]);
    expect(instance.userData.propId).toBe('ruin_wall_b');
  });

  it('rejects malformed and over-budget scenes before a live replacement', () => {
    const entry = ENVIRONMENT_ASSET_CATALOG.falkmoor_ruin_arch_a;
    const missingCollider = validScene(entry);
    missingCollider.getObjectByName(entry.colliderNode)?.removeFromParent();
    expect(() => compileEnvironmentModelAsset(entry, missingCollider)).toThrow('missing collider metadata');

    const overBudget = validScene(entry);
    const high = overBudget.getObjectByName(entry.lods[0].node)!;
    high.clear();
    high.add(triangleMesh('too-dense', entry.lods[0].maxTriangles + 1));
    expect(() => compileEnvironmentModelAsset(entry, overBudget)).toThrow('budget is');
  });
});
