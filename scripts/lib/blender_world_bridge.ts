import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CONTENT, CONTENT_VERSION } from '../../src/sim/content';
import { REGION_MAX, REGION_MIN, ROAD_POINTS, terrainHeight } from '../../src/sim/world/terrain';
import { mapDefinition } from '../../src/ui/world_map';

export const BLENDER_WORLD_SCHEMA_VERSION = 1;
export const BLENDER_AUTHORING_SEED = 20260730;
export const BLENDER_TERRAIN_STEP_METERS = 8;

export type BlenderPlacementType = 'prop' | 'door' | 'container' | 'spawner' | 'landmark';

export interface BlenderTransform {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export interface BlenderWorldPlacement {
  recordType: BlenderPlacementType;
  id: string;
  spaceId: string;
  kind: string;
  transform: BlenderTransform;
  dimensions?: [number, number, number];
  solid?: boolean;
  assetId?: string;
  grounded: boolean;
  data: Record<string, string | number | boolean | null>;
}

export interface BlenderWorldAsset {
  id: string;
  type: string;
  glbPath: string;
  dimensionsMeters: [number, number, number];
  license: string;
  author: string;
  lods: Array<{ name: string; node: string; maxTriangles: number; maxMaterials: number }>;
  maxTextures: number;
}

export interface BlenderTerrainReference {
  spaceId: string;
  seed: number;
  minX: number;
  minZ: number;
  stepMeters: number;
  columns: number;
  rows: number;
  heights: number[];
}

export interface BlenderWorldSnapshot {
  schemaVersion: number;
  contentVersion: string;
  generatedBy: string;
  authority: 'reference-only';
  coordinateSystem: {
    units: 'meters';
    claurimUpAxis: 'Y';
    blenderUpAxis: 'Z';
    mapping: 'Blender X=Claurim X, Blender Y=Claurim Z, Blender Z=Claurim Y';
  };
  spaces: Array<{
    id: string;
    name: string;
    kind: 'exterior' | 'interior';
    ceilingY: number | null;
    rooms: Array<{ x0: number; z0: number; x1: number; z1: number }>;
  }>;
  roads: Array<{ id: string; spaceId: string; points: Array<{ x: number; z: number }> }>;
  assets: BlenderWorldAsset[];
  terrainReferences: BlenderTerrainReference[];
  placements: BlenderWorldPlacement[];
}

export interface BlenderWorldExport {
  schemaVersion: number;
  sourceContentVersion: string;
  exportedBy: string;
  runtimeAuthority: 'proposal';
  placements: BlenderWorldPlacement[];
}

interface AssetManifestShape {
  schemaVersion: number;
  assets: Array<{
    id: string;
    type: string;
    export: string;
    dimensionsMeters: [number, number, number];
    provenance: { license: string; author: string };
    lods: Array<{ name: string; node: string; maxTriangles: number; maxMaterials: number }>;
    maxTextures: number;
  }>;
}

const LIVE_PILOT_BY_PROP_KIND: Readonly<Record<string, string>> = {
  ruin_tower: 'falkmoor_ruin_tower_a',
  ruin_wall: 'falkmoor_ruin_wall_a',
  ruin_arch: 'falkmoor_ruin_arch_a',
};

function rounded(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function groundY(spaceId: string, x: number, z: number): number {
  return CONTENT.spaces[spaceId]?.kind === 'exterior'
    ? rounded(terrainHeight(x, z, BLENDER_AUTHORING_SEED))
    : 0;
}

function placementSort(a: BlenderWorldPlacement, b: BlenderWorldPlacement): number {
  return a.spaceId.localeCompare(b.spaceId)
    || a.recordType.localeCompare(b.recordType)
    || a.id.localeCompare(b.id);
}

function terrainReference(): BlenderTerrainReference {
  const columns = Math.floor((REGION_MAX - REGION_MIN) / BLENDER_TERRAIN_STEP_METERS) + 1;
  const rows = columns;
  const heights: number[] = [];
  for (let row = 0; row < rows; row++) {
    const z = REGION_MIN + row * BLENDER_TERRAIN_STEP_METERS;
    for (let column = 0; column < columns; column++) {
      const x = REGION_MIN + column * BLENDER_TERRAIN_STEP_METERS;
      heights.push(rounded(terrainHeight(x, z, BLENDER_AUTHORING_SEED)));
    }
  }
  return {
    spaceId: 'kaldwyn',
    seed: BLENDER_AUTHORING_SEED,
    minX: REGION_MIN,
    minZ: REGION_MIN,
    stepMeters: BLENDER_TERRAIN_STEP_METERS,
    columns,
    rows,
    heights,
  };
}

function propPlacements(): BlenderWorldPlacement[] {
  return CONTENT.props.map((prop) => ({
    recordType: 'prop',
    id: prop.id,
    spaceId: prop.spaceId,
    kind: prop.kind,
    transform: {
      x: prop.x,
      y: prop.y ?? groundY(prop.spaceId, prop.x, prop.z),
      z: prop.z,
      yaw: prop.yaw ?? 0,
    },
    dimensions: [prop.sx, prop.sy, prop.sz],
    solid: prop.solid,
    assetId: LIVE_PILOT_BY_PROP_KIND[prop.kind],
    grounded: prop.y === undefined,
    data: {},
  }));
}

function doorPlacements(): BlenderWorldPlacement[] {
  return CONTENT.doors.map((door) => ({
    recordType: 'door',
    id: door.id,
    spaceId: door.spaceId,
    kind: 'door',
    transform: {
      x: door.x,
      y: groundY(door.spaceId, door.x, door.z),
      z: door.z,
      yaw: door.yaw ?? 0,
    },
    grounded: CONTENT.spaces[door.spaceId]?.kind === 'exterior',
    data: {
      name: door.name,
      target_space_id: door.targetSpaceId,
      target_x: door.targetX,
      target_z: door.targetZ,
      target_yaw: door.targetYaw,
      anchor_prop_id: door.anchor?.propId ?? null,
      anchor_local_x: door.anchor?.localX ?? 0,
      anchor_local_z: door.anchor?.localZ ?? 0,
      anchor_yaw_offset: door.anchor?.yawOffset ?? 0,
    },
  }));
}

function containerPlacements(): BlenderWorldPlacement[] {
  return CONTENT.containers.map((container) => ({
    recordType: 'container',
    id: container.id,
    spaceId: container.spaceId,
    kind: 'container',
    transform: {
      x: container.x,
      y: groundY(container.spaceId, container.x, container.z),
      z: container.z,
      yaw: 0,
    },
    grounded: CONTENT.spaces[container.spaceId]?.kind === 'exterior',
    data: { name: container.name, loot_table: container.lootTable },
  }));
}

function spawnerPlacements(): BlenderWorldPlacement[] {
  return CONTENT.spawners.map((spawner) => ({
    recordType: 'spawner',
    id: spawner.id,
    spaceId: spawner.spaceId,
    kind: 'spawner',
    transform: {
      x: spawner.x,
      y: groundY(spawner.spaceId, spawner.x, spawner.z),
      z: spawner.z,
      yaw: 0,
    },
    grounded: CONTENT.spaces[spawner.spaceId]?.kind === 'exterior',
    data: {
      actor_id: spawner.actorId,
      count: spawner.count,
      radius: spawner.radius,
      encounter_id: spawner.encounterId ?? null,
      respawn_game_hours: spawner.respawnGameHours,
    },
  }));
}

function landmarkPlacements(): BlenderWorldPlacement[] {
  return mapDefinition('kaldwyn').landmarks.map((landmark) => ({
    recordType: 'landmark' as const,
    id: landmark.id,
    spaceId: landmark.spaceId,
    kind: landmark.kind ?? 'landmark',
    transform: {
      x: landmark.x,
      y: groundY(landmark.spaceId, landmark.x, landmark.z),
      z: landmark.z,
      yaw: 0,
    },
    grounded: CONTENT.spaces[landmark.spaceId]?.kind === 'exterior',
    data: { name: landmark.name },
  }));
}

export function buildCurrentBlenderWorldSnapshot(repoRoot: string): BlenderWorldSnapshot {
  const manifest = JSON.parse(readFileSync(resolve(repoRoot, 'art/asset-manifest.json'), 'utf8')) as AssetManifestShape;
  const placements = [
    ...propPlacements(),
    ...doorPlacements(),
    ...containerPlacements(),
    ...spawnerPlacements(),
    ...landmarkPlacements(),
  ].sort(placementSort);
  return {
    schemaVersion: BLENDER_WORLD_SCHEMA_VERSION,
    contentVersion: CONTENT_VERSION,
    generatedBy: 'scripts/export_blender_world.ts',
    authority: 'reference-only',
    coordinateSystem: {
      units: 'meters',
      claurimUpAxis: 'Y',
      blenderUpAxis: 'Z',
      mapping: 'Blender X=Claurim X, Blender Y=Claurim Z, Blender Z=Claurim Y',
    },
    spaces: Object.values(CONTENT.spaces).sort((a, b) => a.id.localeCompare(b.id)).map((space) => ({
      id: space.id,
      name: space.name,
      kind: space.kind,
      ceilingY: space.interior?.ceilingY ?? null,
      rooms: (space.interior?.rooms ?? []).map((room) => ({ ...room })),
    })),
    roads: [{
      id: 'kaldwyn_main_road',
      spaceId: 'kaldwyn',
      points: ROAD_POINTS.map((point) => ({ ...point })),
    }],
    assets: manifest.assets.map((asset) => ({
      id: asset.id,
      type: asset.type,
      glbPath: asset.export.replace(/^public\//, ''),
      dimensionsMeters: asset.dimensionsMeters,
      license: asset.provenance.license,
      author: asset.provenance.author,
      lods: asset.lods.map((lod) => ({ ...lod })),
      maxTextures: asset.maxTextures,
    })).sort((a, b) => a.id.localeCompare(b.id)),
    terrainReferences: [terrainReference()],
    placements,
  };
}

export function createBaselineBlenderWorldExport(snapshot: BlenderWorldSnapshot): BlenderWorldExport {
  return {
    schemaVersion: BLENDER_WORLD_SCHEMA_VERSION,
    sourceContentVersion: snapshot.contentVersion,
    exportedBy: 'Claurim Blender Bridge 1.0.0',
    runtimeAuthority: 'proposal',
    placements: structuredClone(snapshot.placements),
  };
}

export function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
