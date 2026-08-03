import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildCurrentBlenderWorldSnapshot,
  stableJson,
  type BlenderWorldExport,
  type BlenderWorldSnapshot,
} from './lib/blender_world_bridge';
import { validateBlenderWorldExport } from './lib/blender_world_validation';

const repoRoot = process.cwd();
const snapshotPath = resolve(repoRoot, 'art/world/current-world.json');
const exportPath = resolve(repoRoot, 'art/world/blender-world-export.json');
const committedSnapshot = JSON.parse(readFileSync(snapshotPath, 'utf8')) as BlenderWorldSnapshot;
const currentSnapshot = buildCurrentBlenderWorldSnapshot(repoRoot);
const exported = JSON.parse(readFileSync(exportPath, 'utf8')) as BlenderWorldExport;
const errors: string[] = [];
if (stableJson(committedSnapshot) !== stableJson(currentSnapshot)) {
  errors.push('art/world/current-world.json is stale; run npm run export:blender-world');
}
const validation = validateBlenderWorldExport(committedSnapshot, exported);
errors.push(...validation.errors);
if (errors.length > 0) {
  for (const error of errors) console.error(`Blender world ERROR: ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Blender world OK: ${exported.placements.length} placements, ${validation.warnings.length} proposal warnings`);
}
