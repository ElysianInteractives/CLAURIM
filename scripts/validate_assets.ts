// Phase A0 asset gate: validates source provenance plus the binary GLB scene
// contract before build/deploy. Runtime registration is deliberately Phase A1.

import { loadAssetManifest, validateAssetManifest } from './lib/asset_validation';

const repoRoot = process.cwd();
const manifest = loadAssetManifest(repoRoot);
const result = validateAssetManifest(manifest, repoRoot);

if (result.errors.length > 0) {
  console.error(`asset validation FAILED (${result.errors.length}):`);
  for (const error of result.errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log('assets OK:', JSON.stringify({
  schemaVersion: manifest.schemaVersion,
  blender: manifest.toolchain.blenderVersion,
  assets: result.metrics,
}));
