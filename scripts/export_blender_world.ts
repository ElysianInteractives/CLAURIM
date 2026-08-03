import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  buildCurrentBlenderWorldSnapshot,
  createBaselineBlenderWorldExport,
  stableJson,
} from './lib/blender_world_bridge';

const repoRoot = process.cwd();
const snapshotPath = resolve(repoRoot, 'art/world/current-world.json');
const exportPath = resolve(repoRoot, 'art/world/blender-world-export.json');
const snapshot = buildCurrentBlenderWorldSnapshot(repoRoot);
mkdirSync(dirname(snapshotPath), { recursive: true });
writeFileSync(snapshotPath, stableJson(snapshot), 'utf8');
writeFileSync(exportPath, stableJson(createBaselineBlenderWorldExport(snapshot)), 'utf8');
console.log(`Blender world snapshot OK: ${snapshot.placements.length} placements, ${snapshot.assets.length} assets`);
