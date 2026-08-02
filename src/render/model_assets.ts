import * as THREE from 'three';
import { missingRigNodes, modelTriangleCount, type ModelDetail } from './model_quality';

export interface CharacterModelAsset {
  archetype: string;
  detail: ModelDetail;
  kind: 'humanoid' | 'quadruped';
  triangles: number;
  instantiate(): THREE.Group;
}

const registeredCharacters = new Map<string, CharacterModelAsset>();

function assetKey(archetype: string, detail: ModelDetail): string {
  return `${archetype}:${detail}`;
}

/** Lazy GLB/glTF ingestion seam. Meshopt-compressed assets are supported. */
export async function loadCharacterModelAsset(
  url: string,
  archetype: string,
  detail: ModelDetail,
  kind: 'humanoid' | 'quadruped',
  triangleBudget: number,
): Promise<CharacterModelAsset> {
  const [{ GLTFLoader }, { clone }, { MeshoptDecoder }] = await Promise.all([
    import('three/examples/jsm/loaders/GLTFLoader.js'),
    import('three/examples/jsm/utils/SkeletonUtils.js'),
    import('three/examples/jsm/libs/meshopt_decoder.module.js'),
  ]);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(url);
  const scene = gltf.scene;
  scene.traverse((part) => {
    if (!(part instanceof THREE.Mesh)) return;
    part.geometry.userData.claurimShared = true;
    for (const material of Array.isArray(part.material) ? part.material : [part.material]) {
      material.userData.claurimShared = true;
    }
  });
  const missing = missingRigNodes(scene, kind);
  if (missing.length > 0) throw new Error(`${archetype} asset missing rig nodes: ${missing.join(', ')}`);
  const triangles = modelTriangleCount(scene);
  if (triangles > triangleBudget) {
    throw new Error(`${archetype} asset has ${triangles} triangles; budget is ${triangleBudget}`);
  }
  return {
    archetype,
    detail,
    kind,
    triangles,
    instantiate: () => {
      const instance = clone(scene) as THREE.Group;
      instance.traverse((part) => {
        if (!(part instanceof THREE.Mesh)) return;
        const cloneMaterial = (material: THREE.Material): THREE.Material => {
          const copy = material.clone();
          delete copy.userData.claurimShared;
          return copy;
        };
        part.material = Array.isArray(part.material)
          ? part.material.map(cloneMaterial)
          : cloneMaterial(part.material);
      });
      return instance;
    },
  };
}

export function registerCharacterModelAsset(asset: CharacterModelAsset): void {
  registeredCharacters.set(assetKey(asset.archetype, asset.detail), asset);
}

export function instantiateCharacterModelAsset(
  archetype: string,
  detail: ModelDetail,
): THREE.Group | null {
  return registeredCharacters.get(assetKey(archetype, detail))?.instantiate() ?? null;
}

export function clearCharacterModelAssets(): void {
  registeredCharacters.clear();
}
