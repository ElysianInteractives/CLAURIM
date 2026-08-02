import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import * as THREE from 'three';

export interface AssetManifest {
  schemaVersion: number;
  toolchain: {
    blenderVersion: string;
    unitMeters: number;
    sourceUpAxis: string;
    runtimeUpAxis: string;
    runtimeFormat: string;
  };
  assets: AssetRecord[];
}

export interface AssetRecord {
  id: string;
  type: string;
  status: string;
  source: string;
  export: string;
  rootNode: string;
  dimensionsMeters: [number, number, number];
  boundsToleranceMeters: number;
  origin: string;
  lods: Array<{
    name: string;
    node: string;
    maxTriangles: number;
    maxMaterials: number;
  }>;
  minimumLodReduction: number;
  maxTextures: number;
  maxEmbeddedTextureBytes: number;
  collider: {
    node: string;
    shape: string;
    solid: boolean;
    sizeMeters: [number, number, number];
  };
  provenance: {
    kind: string;
    author: string;
    license: string;
    sourceUrl: string | null;
    notes: string;
  };
}

interface GltfAccessor {
  count?: number;
  min?: number[];
  max?: number[];
}

interface GltfPrimitive {
  attributes?: Record<string, number>;
  indices?: number;
  material?: number;
  mode?: number;
}

interface GltfNode {
  name?: string;
  mesh?: number;
  children?: number[];
  matrix?: number[];
  translation?: number[];
  rotation?: number[];
  scale?: number[];
  extras?: Record<string, unknown>;
}

interface GltfDocument {
  asset?: { version?: string; generator?: string };
  scene?: number;
  scenes?: Array<{ nodes?: number[] }>;
  nodes?: GltfNode[];
  meshes?: Array<{ primitives?: GltfPrimitive[] }>;
  accessors?: GltfAccessor[];
  materials?: unknown[];
  textures?: unknown[];
  images?: Array<{ bufferView?: number; uri?: string }>;
  bufferViews?: Array<{ byteLength?: number }>;
  buffers?: Array<{ uri?: string }>;
}

export interface AssetMetric {
  id: string;
  lodTriangles: Record<string, number>;
  lodMaterials: Record<string, number>;
  dimensionsMeters: [number, number, number];
  textures: number;
  embeddedTextureBytes: number;
}

export interface AssetValidationResult {
  errors: string[];
  metrics: AssetMetric[];
}

const ID_PATTERN = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
const GLB_MAGIC = 0x46546c67;
const GLB_JSON_CHUNK = 0x4e4f534a;

function safeRepoPath(repoRoot: string, relativePath: string): string | null {
  if (relativePath.includes('\\') || relativePath.startsWith('/') || /^[A-Za-z]:/.test(relativePath)) {
    return null;
  }
  const root = resolve(repoRoot);
  const full = resolve(root, relativePath);
  const fromRoot = relative(root, full);
  return fromRoot === '' || (!fromRoot.startsWith('..') && !isAbsolute(fromRoot)) ? full : null;
}

function parseGlb(path: string): GltfDocument {
  const data = readFileSync(path);
  if (data.length < 20 || data.readUInt32LE(0) !== GLB_MAGIC) {
    throw new Error('not a glTF Binary file');
  }
  if (data.readUInt32LE(4) !== 2) throw new Error('GLB version must be 2');
  if (data.readUInt32LE(8) !== data.length) throw new Error('GLB declared length does not match file');
  const jsonLength = data.readUInt32LE(12);
  if (data.readUInt32LE(16) !== GLB_JSON_CHUNK) throw new Error('first GLB chunk is not JSON');
  if (20 + jsonLength > data.length) throw new Error('GLB JSON chunk exceeds file length');
  const text = data.subarray(20, 20 + jsonLength).toString('utf8').replace(/[\u0000 ]+$/g, '');
  return JSON.parse(text) as GltfDocument;
}

function nodeMatrix(node: GltfNode): THREE.Matrix4 {
  if (node.matrix?.length === 16) return new THREE.Matrix4().fromArray(node.matrix);
  const translation = new THREE.Vector3(...(node.translation ?? [0, 0, 0]) as [number, number, number]);
  const rotation = new THREE.Quaternion(...(node.rotation ?? [0, 0, 0, 1]) as [number, number, number, number]);
  const scale = new THREE.Vector3(...(node.scale ?? [1, 1, 1]) as [number, number, number]);
  return new THREE.Matrix4().compose(translation, rotation, scale);
}

function worldMatrices(gltf: GltfDocument): Map<number, THREE.Matrix4> {
  const result = new Map<number, THREE.Matrix4>();
  const nodes = gltf.nodes ?? [];
  const scene = (gltf.scenes ?? [])[gltf.scene ?? 0];
  const roots = scene?.nodes ?? nodes.map((_node, index) => index);
  const visit = (index: number, parent: THREE.Matrix4): void => {
    const node = nodes[index];
    if (!node) return;
    const world = parent.clone().multiply(nodeMatrix(node));
    result.set(index, world);
    for (const child of node.children ?? []) visit(child, world);
  };
  for (const root of roots) visit(root, new THREE.Matrix4());
  return result;
}

function descendantNodeIndices(gltf: GltfDocument, root: number): number[] {
  const nodes = gltf.nodes ?? [];
  const result: number[] = [];
  const visit = (index: number): void => {
    if (result.includes(index)) return;
    result.push(index);
    for (const child of nodes[index]?.children ?? []) visit(child);
  };
  visit(root);
  return result;
}

function primitiveTriangles(primitive: GltfPrimitive, accessors: GltfAccessor[]): number {
  if ((primitive.mode ?? 4) !== 4) return 0;
  const count = primitive.indices === undefined
    ? accessors[primitive.attributes?.POSITION ?? -1]?.count
    : accessors[primitive.indices]?.count;
  return Math.floor((count ?? 0) / 3);
}

function measureLod(
  gltf: GltfDocument,
  lodNodeIndex: number,
  matrices: Map<number, THREE.Matrix4>,
): { triangles: number; materials: number; bounds: THREE.Box3 } {
  const nodes = gltf.nodes ?? [];
  const meshes = gltf.meshes ?? [];
  const accessors = gltf.accessors ?? [];
  const materialIndices = new Set<number>();
  const bounds = new THREE.Box3();
  let triangles = 0;

  for (const nodeIndex of descendantNodeIndices(gltf, lodNodeIndex)) {
    const node = nodes[nodeIndex];
    if (node?.mesh === undefined) continue;
    const matrix = matrices.get(nodeIndex) ?? new THREE.Matrix4();
    for (const primitive of meshes[node.mesh]?.primitives ?? []) {
      triangles += primitiveTriangles(primitive, accessors);
      if (primitive.material !== undefined) materialIndices.add(primitive.material);
      const accessor = accessors[primitive.attributes?.POSITION ?? -1];
      if (!accessor?.min || !accessor.max || accessor.min.length < 3 || accessor.max.length < 3) continue;
      for (const x of [accessor.min[0], accessor.max[0]]) {
        for (const y of [accessor.min[1], accessor.max[1]]) {
          for (const z of [accessor.min[2], accessor.max[2]]) {
            bounds.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(matrix));
          }
        }
      }
    }
  }
  return { triangles, materials: materialIndices.size, bounds };
}

function extrasString(node: GltfNode | undefined, key: string): string | undefined {
  const value = node?.extras?.[key];
  return typeof value === 'string' ? value : undefined;
}

function validateManifestShape(manifest: AssetManifest): string[] {
  const errors: string[] = [];
  if (manifest.schemaVersion !== 1) errors.push('manifest: schemaVersion must be 1');
  if (manifest.toolchain?.blenderVersion !== '5.2.0 LTS') {
    errors.push('manifest: Blender toolchain must be 5.2.0 LTS');
  }
  if (manifest.toolchain?.unitMeters !== 1) errors.push('manifest: unitMeters must be 1');
  if (manifest.toolchain?.sourceUpAxis !== 'Z' || manifest.toolchain?.runtimeUpAxis !== 'Y') {
    errors.push('manifest: source/runtime axes must be Blender Z-up to glTF Y-up');
  }
  if (!Array.isArray(manifest.assets) || manifest.assets.length === 0) {
    errors.push('manifest: assets must be a non-empty array');
    return errors;
  }
  const ids = new Set<string>();
  for (const asset of manifest.assets) {
    const prefix = asset?.id || '<missing-id>';
    if (!ID_PATTERN.test(asset?.id ?? '')) errors.push(`${prefix}: invalid stable asset id`);
    if (ids.has(asset.id)) errors.push(`${prefix}: duplicate asset id`);
    ids.add(asset.id);
    if (asset.rootNode !== asset.id) errors.push(`${prefix}: rootNode must equal the stable asset id`);
    if (asset.origin !== 'ground-center') errors.push(`${prefix}: origin must be ground-center`);
    if (!asset.source?.endsWith('.blend')) errors.push(`${prefix}: source must be a .blend file`);
    if (!asset.export?.endsWith('.glb')) errors.push(`${prefix}: export must be a .glb file`);
    if (!Array.isArray(asset.dimensionsMeters) || asset.dimensionsMeters.some((value) => !(value > 0))) {
      errors.push(`${prefix}: dimensionsMeters must contain three positive values`);
    }
    if (asset.lods?.length !== 2 || asset.lods[0]?.name !== 'LOD0' || asset.lods[1]?.name !== 'LOD1') {
      errors.push(`${prefix}: pilot assets require ordered LOD0 and LOD1 records`);
    }
    if (!(asset.minimumLodReduction > 0 && asset.minimumLodReduction < 1)) {
      errors.push(`${prefix}: minimumLodReduction must be between 0 and 1`);
    }
    if (!asset.provenance?.author || !asset.provenance?.license || !asset.provenance?.notes) {
      errors.push(`${prefix}: provenance author, license, and notes are required`);
    }
    if (asset.provenance?.kind === 'external' && !asset.provenance.sourceUrl) {
      errors.push(`${prefix}: external provenance requires sourceUrl`);
    }
  }
  return errors;
}

export function loadAssetManifest(repoRoot: string): AssetManifest {
  return JSON.parse(readFileSync(resolve(repoRoot, 'art/asset-manifest.json'), 'utf8')) as AssetManifest;
}

export function validateAssetManifest(manifest: AssetManifest, repoRoot: string): AssetValidationResult {
  const errors = validateManifestShape(manifest);
  const metrics: AssetMetric[] = [];

  for (const asset of manifest.assets ?? []) {
    const prefix = asset.id || '<missing-id>';
    const sourcePath = safeRepoPath(repoRoot, asset.source ?? '');
    const exportPath = safeRepoPath(repoRoot, asset.export ?? '');
    if (!sourcePath) errors.push(`${prefix}: source path must remain inside the repository`);
    else if (!existsSync(sourcePath)) errors.push(`${prefix}: missing Blender source ${asset.source}`);
    if (!exportPath) {
      errors.push(`${prefix}: export path must remain inside the repository`);
      continue;
    }
    if (!existsSync(exportPath)) {
      errors.push(`${prefix}: missing GLB export ${asset.export}`);
      continue;
    }

    let gltf: GltfDocument;
    try {
      gltf = parseGlb(exportPath);
    } catch (error) {
      errors.push(`${prefix}: ${(error as Error).message}`);
      continue;
    }
    if (gltf.asset?.version !== '2.0') errors.push(`${prefix}: glTF asset version must be 2.0`);
    if (!(gltf.asset?.generator ?? '').toLowerCase().includes('blender')) {
      errors.push(`${prefix}: export generator must identify Blender`);
    }
    if ((gltf.buffers ?? []).some((buffer) => Boolean(buffer.uri))) {
      errors.push(`${prefix}: GLB may not reference external buffers`);
    }
    if ((gltf.images ?? []).some((image) => Boolean(image.uri))) {
      errors.push(`${prefix}: runtime textures must be embedded in the GLB during Phase A0`);
    }

    const nodes = gltf.nodes ?? [];
    const rootIndex = nodes.findIndex((node) => node.name === asset.rootNode);
    if (rootIndex < 0) {
      errors.push(`${prefix}: missing root node ${asset.rootNode}`);
      continue;
    }
    const root = nodes[rootIndex];
    if (extrasString(root, 'asset_id') !== asset.id) errors.push(`${prefix}: root asset_id extra does not match`);
    if (extrasString(root, 'origin') !== 'ground-center') errors.push(`${prefix}: root origin extra is not ground-center`);
    if (root?.scale?.some((value) => Math.abs(value - 1) > 1e-5)) {
      errors.push(`${prefix}: root has unapplied scale`);
    }

    const matrices = worldMatrices(gltf);
    const lodTriangles: Record<string, number> = {};
    const lodMaterials: Record<string, number> = {};
    let lod0Bounds: THREE.Box3 | undefined;
    for (const lod of asset.lods ?? []) {
      const nodeIndex = nodes.findIndex((node) => node.name === lod.node);
      if (nodeIndex < 0) {
        errors.push(`${prefix}: missing ${lod.name} node ${lod.node}`);
        continue;
      }
      if (extrasString(nodes[nodeIndex], 'lod') !== lod.name) {
        errors.push(`${prefix}: ${lod.name} node extra does not match`);
      }
      const measured = measureLod(gltf, nodeIndex, matrices);
      lodTriangles[lod.name] = measured.triangles;
      lodMaterials[lod.name] = measured.materials;
      if (lod.name === 'LOD0') lod0Bounds = measured.bounds;
      if (measured.triangles <= 0) errors.push(`${prefix}: ${lod.name} has no triangles`);
      if (measured.triangles > lod.maxTriangles) {
        errors.push(`${prefix}: ${lod.name} has ${measured.triangles} triangles; budget is ${lod.maxTriangles}`);
      }
      if (measured.materials > lod.maxMaterials) {
        errors.push(`${prefix}: ${lod.name} has ${measured.materials} materials; budget is ${lod.maxMaterials}`);
      }
    }
    const lod0Triangles = lodTriangles.LOD0 ?? 0;
    const lod1Triangles = lodTriangles.LOD1 ?? Number.POSITIVE_INFINITY;
    if (lod0Triangles > 0 && lod1Triangles > lod0Triangles * (1 - asset.minimumLodReduction)) {
      errors.push(`${prefix}: LOD1 does not meet the ${asset.minimumLodReduction * 100}% triangle reduction`);
    }

    const colliderIndex = nodes.findIndex((node) => node.name === asset.collider?.node);
    if (colliderIndex < 0) errors.push(`${prefix}: missing collider metadata node ${asset.collider?.node}`);
    else {
      const collider = nodes[colliderIndex];
      if (extrasString(collider, 'role') !== 'collider') errors.push(`${prefix}: collider role extra is missing`);
      if (extrasString(collider, 'shape') !== asset.collider.shape) errors.push(`${prefix}: collider shape extra does not match`);
      if (Boolean(collider.extras?.solid) !== asset.collider.solid) errors.push(`${prefix}: collider solid extra does not match`);
    }

    const textureCount = gltf.textures?.length ?? 0;
    const embeddedTextureBytes = (gltf.images ?? []).reduce((total, image) => (
      total + (image.bufferView === undefined ? 0 : (gltf.bufferViews?.[image.bufferView]?.byteLength ?? 0))
    ), 0);
    if (textureCount > asset.maxTextures) errors.push(`${prefix}: texture count ${textureCount} exceeds ${asset.maxTextures}`);
    if (embeddedTextureBytes > asset.maxEmbeddedTextureBytes) {
      errors.push(`${prefix}: embedded texture bytes ${embeddedTextureBytes} exceed ${asset.maxEmbeddedTextureBytes}`);
    }

    let dimensions: [number, number, number] = [0, 0, 0];
    if (lod0Bounds && !lod0Bounds.isEmpty()) {
      const size = lod0Bounds.getSize(new THREE.Vector3());
      dimensions = [size.x, size.y, size.z];
      if (lod0Bounds.min.y < -asset.boundsToleranceMeters || lod0Bounds.min.y > asset.boundsToleranceMeters) {
        errors.push(`${prefix}: LOD0 ground contact is ${lod0Bounds.min.y.toFixed(3)} m instead of 0`);
      }
      for (let axis = 0; axis < 3; axis++) {
        const expected = asset.dimensionsMeters[axis];
        if (Math.abs(dimensions[axis] - expected) > asset.boundsToleranceMeters) {
          errors.push(`${prefix}: LOD0 axis ${axis} is ${dimensions[axis].toFixed(3)} m; expected ${expected} ± ${asset.boundsToleranceMeters}`);
        }
      }
    }
    metrics.push({
      id: asset.id,
      lodTriangles,
      lodMaterials,
      dimensionsMeters: dimensions,
      textures: textureCount,
      embeddedTextureBytes,
    });
  }

  return { errors, metrics };
}
