import { describe, expect, it } from 'vitest';
import {
  loadAssetManifest,
  validateAssetManifest,
  type AssetManifest,
} from '../scripts/lib/asset_validation';

describe('Asset Phase A0 Blender authoring contract', () => {
  it('accepts the complete Falkmoor pilot kit and its exported geometry budgets', () => {
    const manifest = loadAssetManifest(process.cwd());
    const result = validateAssetManifest(manifest, process.cwd());

    expect(result.errors).toEqual([]);
    expect(manifest.toolchain).toMatchObject({
      blenderVersion: '5.2.0 LTS',
      unitMeters: 1,
      sourceUpAxis: 'Z',
      runtimeUpAxis: 'Y',
    });
    expect(result.metrics.map((metric) => metric.id)).toEqual([
      'falkmoor_ruin_tower_a',
      'falkmoor_ruin_wall_a',
      'falkmoor_ruin_arch_a',
    ]);
    for (const metric of result.metrics) {
      expect(metric.lodTriangles.LOD0).toBeGreaterThan(metric.lodTriangles.LOD1);
      expect(metric.dimensionsMeters.every((dimension) => dimension > 0)).toBe(true);
    }
  });

  it('rejects duplicate IDs and external assets without source provenance', () => {
    const manifest = structuredClone(loadAssetManifest(process.cwd())) as AssetManifest;
    manifest.assets[1].id = manifest.assets[0].id;
    manifest.assets[1].provenance.kind = 'external';
    manifest.assets[1].provenance.sourceUrl = null;

    const result = validateAssetManifest(manifest, process.cwd());
    expect(result.errors.some((error) => error.includes('duplicate asset id'))).toBe(true);
    expect(result.errors.some((error) => error.includes('external provenance requires sourceUrl'))).toBe(true);
  });

  it('rejects paths that escape the repository', () => {
    const manifest = structuredClone(loadAssetManifest(process.cwd())) as AssetManifest;
    manifest.assets[0].export = '../outside.glb';

    const result = validateAssetManifest(manifest, process.cwd());
    expect(result.errors.some((error) => error.includes('export path must remain inside'))).toBe(true);
  });
});
