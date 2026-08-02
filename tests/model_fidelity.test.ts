import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildCharacter, syncCharacterEquipment } from '../src/render/characters';
import {
  characterModelDetail,
  characterWithinRenderDistance,
  missingRigNodes,
  modelTriangleCount,
} from '../src/render/model_quality';
import {
  clearCharacterModelAssets,
  registerCharacterModelAsset,
} from '../src/render/model_assets';
import { buildContainerMesh, buildDoorMarker, buildProp } from '../src/render/structures';
import { TerrainStreamer } from '../src/render/terrain_mesh';
import { CONTENT } from '../src/sim/content';
import { Sim } from '../src/sim/sim';
import { SimWorld } from '../src/game/sim_world';

afterEach(() => clearCharacterModelAssets());

describe('QA Phase N game-ready model fidelity', () => {
  it('uses a materially denser close humanoid while preserving every rig socket', () => {
    const high = buildCharacter('player', 'high');
    const medium = buildCharacter('player', 'medium');
    const highTriangles = modelTriangleCount(high);
    const mediumTriangles = modelTriangleCount(medium);

    expect(missingRigNodes(high, 'humanoid')).toEqual([]);
    expect(missingRigNodes(medium, 'humanoid')).toEqual([]);
    expect(highTriangles).toBeGreaterThanOrEqual(5_000);
    expect(highTriangles).toBeGreaterThan(mediumTriangles * 5);
    expect(highTriangles).toBeLessThanOrEqual(20_000);
  });

  it('upgrades every wildlife family and retains articulated quadruped nodes', () => {
    for (const archetype of ['wolf', 'hart', 'boar', 'rat']) {
      const high = buildCharacter(archetype, 'high');
      const medium = buildCharacter(archetype, 'medium');
      expect(missingRigNodes(high, 'quadruped'), archetype).toEqual([]);
      expect(modelTriangleCount(high), archetype).toBeGreaterThan(modelTriangleCount(medium) * 5);
      expect(modelTriangleCount(high), archetype).toBeLessThanOrEqual(15_000);
    }
  });

  it('selects actor LOD with hysteresis and never lowers the local player', () => {
    expect(characterModelDetail(25, 'high')).toBe('high');
    expect(characterModelDetail(27, 'high')).toBe('medium');
    expect(characterModelDetail(21, 'medium')).toBe('medium');
    expect(characterModelDetail(19, 'medium')).toBe('high');
    expect(characterModelDetail(1_000, 'medium', true)).toBe('high');
    expect(characterWithinRenderDistance(110, true)).toBe(true);
    expect(characterWithinRenderDistance(121, true)).toBe(false);
    expect(characterWithinRenderDistance(101, false)).toBe(false);
    expect(characterWithinRenderDistance(1_000, false, true)).toBe(true);
  });

  it('accepts validated registered asset overrides behind the same build seam', () => {
    const source = buildCharacter('player', 'medium');
    source.userData.assetMarker = 'registered-glb';
    registerCharacterModelAsset({
      archetype: 'asset_override',
      detail: 'medium',
      kind: 'humanoid',
      triangles: modelTriangleCount(source),
      instantiate: () => source.clone(true),
    });

    const instance = buildCharacter('asset_override', 'medium');
    expect(instance.userData.assetMarker).toBe('registered-glb');
    expect(missingRigNodes(instance, 'humanoid')).toEqual([]);
  });

  it('gives buildings a high-detail beveled level and a bounded distant shell', () => {
    const prop = CONTENT.props.find((candidate) => candidate.kind.startsWith('building'))!;
    const group = buildProp(prop, 'exterior', 42);
    const lod = group.getObjectByName('building-lod') as THREE.LOD;

    expect(lod).toBeInstanceOf(THREE.LOD);
    expect(lod.levels).toHaveLength(2);
    expect(lod.levels[1].distance).toBe(55);
    expect(lod.levels[1].hysteresis).toBe(0.15);
    const highTriangles = modelTriangleCount(lod.levels[0].object);
    const mediumTriangles = modelTriangleCount(lod.levels[1].object);
    expect(highTriangles).toBeGreaterThanOrEqual(8_000);
    expect(highTriangles).toBeGreaterThan(mediumTriangles * 20);
    expect(highTriangles).toBeLessThanOrEqual(40_000);
  });

  it('keeps dense vegetation instanced while switching nine near cells to high geometry', () => {
    const scene = new THREE.Scene();
    const terrain = new TerrainStreamer(scene, 42);
    terrain.update(42, 158, 2);
    const cells = scene.children.filter((child) => child.getObjectByName('decoration-high'));
    const highCells = cells.filter((cell) => cell.getObjectByName('decoration-high')!.visible);
    const mediumCells = cells.filter((cell) => cell.getObjectByName('decoration-medium')!.visible);
    const detailedCell = highCells.find((cell) => modelTriangleCount(cell.getObjectByName('decoration-high')!) > 0)!;

    expect(cells).toHaveLength(25);
    expect(highCells).toHaveLength(9);
    expect(mediumCells).toHaveLength(16);
    expect(modelTriangleCount(detailedCell.getObjectByName('decoration-high')!))
      .toBeGreaterThan(modelTriangleCount(detailedCell.getObjectByName('decoration-medium')!));
    expect(scene.children.some((cell) => cell.getObjectByName('tree-tops-high') instanceof THREE.InstancedMesh)).toBe(true);
  });

  it('holds complete populated exterior checkpoints inside the fidelity render budget', () => {
    const checkpoints = [
      { name: 'Fenharrow', x: 42, z: 158 },
      { name: 'Thornmere', x: -10, z: -180 },
      { name: 'Weeping Stones', x: 80, z: 270 },
    ];
    for (const checkpoint of checkpoints) {
      const scene = new THREE.Scene();
      const terrain = new TerrainStreamer(scene, 42);
      terrain.update(checkpoint.x, checkpoint.z, 2);
      for (const prop of CONTENT.props) {
        if (prop.spaceId === 'kaldwyn') scene.add(buildProp(prop, 'exterior', 42));
      }
      for (const door of CONTENT.doors) {
        if (door.spaceId === 'kaldwyn') scene.add(buildDoorMarker(door, 'exterior', 42));
      }
      for (const container of CONTENT.containers) {
        if (container.spaceId === 'kaldwyn') scene.add(buildContainerMesh(container, 'exterior', 42));
      }

      const sim = new Sim(42);
      sim.movePlayerTo('p1', 'kaldwyn', checkpoint.x, checkpoint.z, 0);
      const world = new SimWorld(sim);
      for (const actor of world.actorsInSpace()) {
        const localPlayer = actor.isPlayer && !actor.isRemotePlayer;
        const distance = Math.hypot(actor.x - checkpoint.x, actor.z - checkpoint.z);
        if (!characterWithinRenderDistance(distance, false, localPlayer)) continue;
        const model = buildCharacter(
          actor.archetype,
          characterModelDetail(distance, undefined, localPlayer),
        );
        syncCharacterEquipment(model, actor, 'world');
        model.position.set(actor.x, actor.y, actor.z);
        scene.add(model);
      }

      const camera = new THREE.PerspectiveCamera();
      camera.position.set(checkpoint.x, 3, checkpoint.z);
      scene.updateMatrixWorld(true);
      scene.traverse((object) => {
        if (object instanceof THREE.LOD) object.update(camera);
      });
      let visibleMeshes = 0;
      scene.traverseVisible((object) => {
        if (object instanceof THREE.Mesh) visibleMeshes++;
      });

      expect(visibleMeshes, `${checkpoint.name} draw nodes`).toBeLessThanOrEqual(325);
      expect(modelTriangleCount(scene, true), `${checkpoint.name} triangles`).toBeLessThanOrEqual(175_000);
    }
  });
});
