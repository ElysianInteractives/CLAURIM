import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BLENDER_AUTHORING_SEED,
  buildCurrentBlenderWorldSnapshot,
  type BlenderWorldExport,
  type BlenderWorldSnapshot,
} from '../scripts/lib/blender_world_bridge';
import {
  validateBlenderWorldExport,
  validateInitialRoundTrip,
} from '../scripts/lib/blender_world_validation';

function committed(): { snapshot: BlenderWorldSnapshot; exported: BlenderWorldExport } {
  return {
    snapshot: JSON.parse(readFileSync(resolve('art/world/current-world.json'), 'utf8')) as BlenderWorldSnapshot,
    exported: JSON.parse(readFileSync(resolve('art/world/blender-world-export.json'), 'utf8')) as BlenderWorldExport,
  };
}

describe('Asset Phase A2 Blender world bridge', () => {
  it('pins a complete current-world snapshot and read-only terrain reference', () => {
    const { snapshot } = committed();
    expect(snapshot).toEqual(buildCurrentBlenderWorldSnapshot(process.cwd()));
    expect(snapshot.authority).toBe('reference-only');
    expect(snapshot.spaces).toHaveLength(5);
    expect(snapshot.assets).toHaveLength(3);
    expect(snapshot.placements.filter((item) => item.recordType === 'prop')).toHaveLength(42);
    expect(snapshot.placements.filter((item) => item.recordType === 'door')).toHaveLength(8);
    expect(snapshot.placements.filter((item) => item.recordType === 'container')).toHaveLength(6);
    expect(snapshot.placements.filter((item) => item.recordType === 'spawner')).toHaveLength(24);
    expect(snapshot.placements.filter((item) => item.recordType === 'landmark')).toHaveLength(8);
    expect(snapshot.terrainReferences[0]).toMatchObject({
      seed: BLENDER_AUTHORING_SEED,
      columns: 129,
      rows: 129,
      stepMeters: 8,
    });
    expect(snapshot.terrainReferences[0].heights).toHaveLength(129 * 129);
  });

  it('round-trips every baseline record while remaining proposal-only', () => {
    const { snapshot, exported } = committed();
    expect(exported.runtimeAuthority).toBe('proposal');
    expect(validateBlenderWorldExport(snapshot, exported)).toEqual({ errors: [], warnings: [] });
    expect(validateInitialRoundTrip(snapshot, exported)).toEqual([]);
  });

  it('accepts a new approved visual prop but rejects unsafe metadata changes', () => {
    const { snapshot, exported } = committed();
    const addition = structuredClone(exported);
    addition.placements.push({
      recordType: 'prop',
      id: 'placed_falkmoor_ruin_arch_a',
      spaceId: 'kaldwyn',
      kind: 'asset_prop',
      transform: { x: 0, y: 12, z: 0, yaw: 0 },
      dimensions: [6, 5, 2],
      solid: false,
      assetId: 'falkmoor_ruin_arch_a',
      grounded: true,
      data: {},
    });
    expect(validateBlenderWorldExport(snapshot, addition).errors).toEqual([]);

    const unsafe = structuredClone(exported);
    unsafe.runtimeAuthority = 'live' as 'proposal';
    unsafe.placements.push(structuredClone(unsafe.placements[0]));
    unsafe.placements[0].assetId = 'unlicensed_asset';
    unsafe.placements.splice(1, 1);
    const errors = validateBlenderWorldExport(snapshot, unsafe).errors;
    expect(errors.some((error) => error.includes('runtimeAuthority'))).toBe(true);
    expect(errors.some((error) => error.includes('duplicate placement'))).toBe(true);
    expect(errors.some((error) => error.includes('unknown asset'))).toBe(true);
    expect(errors.some((error) => error.includes('may not be deleted'))).toBe(true);
  });

  it('ships the editable scene, evidence, add-on, and repeatable headless scripts', () => {
    for (const path of [
      'art/blender/claurim_world.blend',
      'docs/screenshots/asset_phase_a2_world_import.png',
      'tools/blender_addon/claurim_world_bridge/__init__.py',
      'tools/blender_addon/claurim_world_bridge/README.md',
      'scripts/blender/build_world_authoring_scene.py',
      'scripts/blender/qa_world_bridge.py',
      'scripts/blender/install_claurim_bridge.py',
    ]) {
      expect(existsSync(resolve(path)), path).toBe(true);
    }
  });
});
