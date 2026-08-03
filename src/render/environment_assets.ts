// Renderer-owned environment asset ingestion. This module can replace a
// procedural visual, but it never owns placement or gameplay collision.

import * as THREE from 'three';
import type { PropDef } from '../sim/content/schema';
import { modelTriangleCount } from './model_quality';

export const ENVIRONMENT_HIGH_DETAIL_DISTANCE = 55;
export const ENVIRONMENT_PRESSURE_DETAIL_DISTANCE = 28;

export type EnvironmentAssetId =
  | 'falkmoor_ruin_tower_a'
  | 'falkmoor_ruin_wall_a'
  | 'falkmoor_ruin_arch_a';

export interface EnvironmentAssetCatalogEntry {
  id: EnvironmentAssetId;
  path: string;
  rootNode: string;
  dimensionsMeters: readonly [number, number, number];
  colliderNode: string;
  lods: readonly [
    { name: 'LOD0'; node: string; maxTriangles: number },
    { name: 'LOD1'; node: string; maxTriangles: number },
  ];
}

/** Browser-safe subset of art/asset-manifest.json. Tests keep both records in
 * lockstep; provenance and authoring-only metadata do not ship at runtime. */
export const ENVIRONMENT_ASSET_CATALOG: Readonly<Record<EnvironmentAssetId, EnvironmentAssetCatalogEntry>> = {
  falkmoor_ruin_tower_a: {
    id: 'falkmoor_ruin_tower_a',
    path: 'assets/models/environment/falkmoor/falkmoor_ruin_tower_a.glb',
    rootNode: 'falkmoor_ruin_tower_a',
    dimensionsMeters: [8, 10, 8],
    colliderNode: 'falkmoor_ruin_tower_a__COLLIDER',
    lods: [
      { name: 'LOD0', node: 'falkmoor_ruin_tower_a__LOD0', maxTriangles: 3000 },
      { name: 'LOD1', node: 'falkmoor_ruin_tower_a__LOD1', maxTriangles: 300 },
    ],
  },
  falkmoor_ruin_wall_a: {
    id: 'falkmoor_ruin_wall_a',
    path: 'assets/models/environment/falkmoor/falkmoor_ruin_wall_a.glb',
    rootNode: 'falkmoor_ruin_wall_a',
    dimensionsMeters: [10, 3, 1.5],
    colliderNode: 'falkmoor_ruin_wall_a__COLLIDER',
    lods: [
      { name: 'LOD0', node: 'falkmoor_ruin_wall_a__LOD0', maxTriangles: 2500 },
      { name: 'LOD1', node: 'falkmoor_ruin_wall_a__LOD1', maxTriangles: 100 },
    ],
  },
  falkmoor_ruin_arch_a: {
    id: 'falkmoor_ruin_arch_a',
    path: 'assets/models/environment/falkmoor/falkmoor_ruin_arch_a.glb',
    rootNode: 'falkmoor_ruin_arch_a',
    dimensionsMeters: [6, 5, 2],
    colliderNode: 'falkmoor_ruin_arch_a__COLLIDER',
    lods: [
      { name: 'LOD0', node: 'falkmoor_ruin_arch_a__LOD0', maxTriangles: 1400 },
      { name: 'LOD1', node: 'falkmoor_ruin_arch_a__LOD1', maxTriangles: 300 },
    ],
  },
};

const ENVIRONMENT_ASSET_FOR_PROP_KIND: Readonly<Record<string, EnvironmentAssetId>> = {
  ruin_tower: 'falkmoor_ruin_tower_a',
  ruin_wall: 'falkmoor_ruin_wall_a',
  ruin_arch: 'falkmoor_ruin_arch_a',
};

export function environmentAssetForProp(prop: Pick<PropDef, 'kind'>): EnvironmentAssetId | null {
  return ENVIRONMENT_ASSET_FOR_PROP_KIND[prop.kind] ?? null;
}

export function resolveEnvironmentAssetUrl(
  path: string,
  baseUrl = import.meta.env.BASE_URL,
  revision = 0,
): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const url = `${base}${path.replace(/^\/+/, '')}`;
  return revision > 0 ? `${url}?claurim_asset_revision=${revision}` : url;
}

function markSharedResources(root: THREE.Object3D): void {
  root.traverse((part) => {
    if (!(part instanceof THREE.Mesh)) return;
    part.geometry.userData.claurimShared = true;
    for (const material of Array.isArray(part.material) ? part.material : [part.material]) {
      material.userData.claurimShared = true;
    }
  });
}

function cloneVisual(source: THREE.Object3D): THREE.Object3D {
  const visual = source.clone(true);
  visual.traverse((part) => {
    if (!(part instanceof THREE.Mesh)) return;
    part.castShadow = true;
    part.receiveShadow = true;
  });
  return visual;
}

export interface EnvironmentModelAsset {
  readonly entry: EnvironmentAssetCatalogEntry;
  readonly triangles: Readonly<Record<'LOD0' | 'LOD1', number>>;
  instantiate(): THREE.Group;
}

/** Compiles a loaded glTF scene into an LOD template. Collider nodes are
 * required metadata, then deliberately excluded from the render instance. */
export function compileEnvironmentModelAsset(
  entry: EnvironmentAssetCatalogEntry,
  scene: THREE.Object3D,
): EnvironmentModelAsset {
  const root = scene.getObjectByName(entry.rootNode);
  if (!root) throw new Error(`${entry.id} is missing root node ${entry.rootNode}`);
  if (!root.getObjectByName(entry.colliderNode)) {
    throw new Error(`${entry.id} is missing collider metadata node ${entry.colliderNode}`);
  }

  const sources = entry.lods.map((lod) => {
    const node = root.getObjectByName(lod.node);
    if (!node) throw new Error(`${entry.id} is missing ${lod.name} node ${lod.node}`);
    const triangles = modelTriangleCount(node);
    if (triangles <= 0) throw new Error(`${entry.id} ${lod.name} has no triangles`);
    if (triangles > lod.maxTriangles) {
      throw new Error(`${entry.id} ${lod.name} has ${triangles} triangles; budget is ${lod.maxTriangles}`);
    }
    markSharedResources(node);
    return { node, triangles };
  });
  const high = sources[0];
  const medium = sources[1];
  if (medium.triangles >= high.triangles) {
    throw new Error(`${entry.id} LOD1 must contain fewer triangles than LOD0`);
  }

  return {
    entry,
    triangles: { LOD0: high.triangles, LOD1: medium.triangles },
    instantiate: () => {
      const instance = new THREE.Group();
      instance.name = `environment-asset:${entry.id}`;
      instance.userData.environmentAssetId = entry.id;
      const lod = new THREE.LOD();
      lod.name = 'environment-asset-lod';
      lod.addLevel(cloneVisual(high.node), 0);
      lod.addLevel(cloneVisual(medium.node), ENVIRONMENT_HIGH_DETAIL_DISTANCE, 0.15);
      instance.add(lod);
      return instance;
    },
  };
}

export function applyEnvironmentPropTransform(
  instance: THREE.Group,
  prop: Pick<PropDef, 'id' | 'x' | 'y' | 'z' | 'yaw' | 'sx' | 'sy' | 'sz'>,
  entry: EnvironmentAssetCatalogEntry,
  groundY: number,
): void {
  instance.name = `environment-asset:${entry.id}:${prop.id}`;
  instance.userData.propId = prop.id;
  instance.position.set(prop.x, prop.y ?? groundY, prop.z);
  instance.rotation.y = prop.yaw ?? 0;
  instance.scale.set(
    prop.sx / entry.dimensionsMeters[0],
    prop.sy / entry.dimensionsMeters[1],
    prop.sz / entry.dimensionsMeters[2],
  );
}

export function setEnvironmentPerformanceDetail(root: THREE.Object3D, enabled: boolean): void {
  root.traverse((object) => {
    if (!(object instanceof THREE.LOD) || object.name !== 'environment-asset-lod') return;
    const medium = object.levels[1];
    if (medium) {
      medium.distance = enabled
        ? ENVIRONMENT_PRESSURE_DETAIL_DISTANCE
        : ENVIRONMENT_HIGH_DETAIL_DISTANCE;
    }
  });
}

export type EnvironmentAssetLoadStatus = 'pending' | 'ready' | 'failed';
export interface EnvironmentAssetDiagnostics {
  pending: number;
  ready: number;
  failed: number;
}

export interface EnvironmentAssetRuntimeOptions {
  baseUrl?: string;
  loadScene: (url: string) => Promise<THREE.Object3D>;
  onError?: (assetId: EnvironmentAssetId, error: Error) => void;
  disposeLoader?: () => void;
}

/** Request-coalescing asset store. A failed request resolves to null so the
 * caller can retain its already-built procedural fallback. */
export class EnvironmentAssetRuntime {
  private generation = 0;
  private requests = new Map<EnvironmentAssetId, Promise<EnvironmentModelAsset | null>>();
  private states = new Map<EnvironmentAssetId, EnvironmentAssetLoadStatus>();

  constructor(private readonly options: EnvironmentAssetRuntimeOptions) {}

  async instantiate(assetId: EnvironmentAssetId): Promise<THREE.Group | null> {
    const asset = await this.load(assetId);
    return asset?.instantiate() ?? null;
  }

  entry(assetId: EnvironmentAssetId): EnvironmentAssetCatalogEntry {
    return ENVIRONMENT_ASSET_CATALOG[assetId];
  }

  diagnostics(): EnvironmentAssetDiagnostics {
    const result: EnvironmentAssetDiagnostics = { pending: 0, ready: 0, failed: 0 };
    for (const status of this.states.values()) result[status] += 1;
    return result;
  }

  invalidate(): void {
    this.generation += 1;
    this.requests.clear();
    this.states.clear();
  }

  dispose(): void {
    this.invalidate();
    this.options.disposeLoader?.();
  }

  private load(assetId: EnvironmentAssetId): Promise<EnvironmentModelAsset | null> {
    const existing = this.requests.get(assetId);
    if (existing) return existing;
    const requestGeneration = this.generation;
    const entry = this.entry(assetId);
    this.states.set(assetId, 'pending');
    const request = this.options.loadScene(resolveEnvironmentAssetUrl(
      entry.path,
      this.options.baseUrl,
      requestGeneration,
    )).then((scene) => {
      const asset = compileEnvironmentModelAsset(entry, scene);
      if (requestGeneration === this.generation) this.states.set(assetId, 'ready');
      return asset;
    }).catch((value: unknown) => {
      const error = value instanceof Error ? value : new Error(String(value));
      if (requestGeneration === this.generation) this.states.set(assetId, 'failed');
      this.options.onError?.(assetId, error);
      return null;
    });
    this.requests.set(assetId, request);
    return request;
  }
}

/** Creates the browser GLB loader lazily, keeping loader code out of the
 * initial chunk. KTX2 uses the vendored Basis transcoder; Meshopt is wired for
 * compressed geometry as soon as authored assets begin using it. */
export function createBrowserEnvironmentAssetRuntime(
  renderer: THREE.WebGLRenderer,
  options: Omit<EnvironmentAssetRuntimeOptions, 'loadScene' | 'disposeLoader'> = {},
): EnvironmentAssetRuntime {
  const baseUrl = options.baseUrl ?? import.meta.env.BASE_URL;
  let ktx2Loader: { dispose(): void } | undefined;
  let loaderPromise: Promise<{ loadAsync(url: string): Promise<{ scene: THREE.Group }> }> | undefined;
  const getLoader = async (): Promise<{ loadAsync(url: string): Promise<{ scene: THREE.Group }> }> => {
    loaderPromise ??= Promise.all([
      import('three/examples/jsm/loaders/GLTFLoader.js'),
      import('three/examples/jsm/loaders/KTX2Loader.js'),
      import('three/examples/jsm/libs/meshopt_decoder.module.js'),
    ]).then(([{ GLTFLoader }, { KTX2Loader }, { MeshoptDecoder }]) => {
      const compressedTextures = new KTX2Loader()
        .setTranscoderPath(resolveEnvironmentAssetUrl('assets/basis/', baseUrl))
        .detectSupport(renderer);
      ktx2Loader = compressedTextures;
      return new GLTFLoader()
        .setMeshoptDecoder(MeshoptDecoder)
        .setKTX2Loader(compressedTextures);
    });
    return loaderPromise;
  };
  return new EnvironmentAssetRuntime({
    ...options,
    baseUrl,
    loadScene: async (url) => (await getLoader()).loadAsync(url).then((gltf) => gltf.scene),
    disposeLoader: () => ktx2Loader?.dispose(),
  });
}
