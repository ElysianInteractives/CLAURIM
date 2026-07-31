// Architectural guard tests (LOCKED D-001). These enforce the load-bearing
// invariants as always-on checks instead of convention prose:
//   - src/sim imports nothing from render/ui/game/net or three
//   - src/sim touches no DOM/browser globals
//   - src/sim uses no Math.random / Date.now / performance.now
//   - src/world_api imports only from sim (types) and itself
// A violation means the sim can no longer run identically in browser, server,
// and headless hosts, or determinism is broken. Keep this green.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const simRoot = join(repoRoot, 'src', 'sim');
const worldApiRoot = join(repoRoot, 'src', 'world_api');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (name.endsWith('.ts') && !name.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

/** Blank comments, preserving line count, so prose can't false-positive. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const IMPORT_RE = /\b(?:import|export)\b[^;'"]*?\bfrom\s*['"]([^'"]+)['"]/g;
const DOM_GLOBAL_RE = /\b(document|window|navigator|localStorage|sessionStorage|requestAnimationFrame)\s*[.([]/;
const NONDETERMINISM_RE = /\b(Math\.random|Date\.now|performance\.now|new\s+Date\s*\()/;

function importsOf(src: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(IMPORT_RE.source, 'g');
  while ((m = re.exec(src))) out.push(m[1]);
  return out;
}

describe('architecture: src/sim is the host-agnostic deterministic core', () => {
  const simFiles = walk(simRoot);

  it('finds sim files (guard is not vacuous)', () => {
    expect(simFiles.length).toBeGreaterThan(10);
  });

  it('sim never imports three or host layers (render/ui/game/net/headless)', () => {
    for (const file of simFiles) {
      const src = stripComments(readFileSync(file, 'utf8'));
      for (const spec of importsOf(src)) {
        expect(spec, `${file} imports ${spec}`).not.toMatch(/^three($|\/)/);
        expect(spec, `${file} imports ${spec}`).not.toMatch(/(?:^|\/)(render|ui|game|net|headless)(\/|$)/);
      }
    }
  });

  it('sim touches no DOM/browser globals', () => {
    for (const file of simFiles) {
      const src = stripComments(readFileSync(file, 'utf8'));
      const hit = src.match(DOM_GLOBAL_RE);
      expect(hit, `${file}: ${hit?.[0] ?? ''}`).toBeNull();
    }
  });

  it('sim draws no randomness or time from outside Rng + the tick counter', () => {
    for (const file of simFiles) {
      const src = stripComments(readFileSync(file, 'utf8'));
      const hit = src.match(NONDETERMINISM_RE);
      expect(hit, `${file}: ${hit?.[0] ?? ''}`).toBeNull();
    }
  });
});

describe('architecture: hosts observe through IWorld, never through Sim', () => {
  it('render/ui never import the concrete Sim or its adapter', () => {
    for (const dir of ['render', 'ui']) {
      const files = walk(join(repoRoot, 'src', dir));
      expect(files.length).toBeGreaterThan(0);
      for (const file of files) {
        const src = stripComments(readFileSync(file, 'utf8'));
        for (const spec of importsOf(src)) {
          expect(spec, `${file} imports ${spec}`).not.toMatch(/sim\/sim$/);
          expect(spec, `${file} imports ${spec}`).not.toMatch(/game\/sim_world$/);
          expect(spec, `${file} imports ${spec}`).not.toMatch(/net\/client_world$/);
          expect(spec, `${file} imports ${spec}`).not.toMatch(/(?:^|\/)server\//);
        }
      }
    }
  });

  it('the sim never imports the server or client network layers', () => {
    for (const file of walk(simRoot)) {
      const src = stripComments(readFileSync(file, 'utf8'));
      for (const spec of importsOf(src)) {
        expect(spec, `${file} imports ${spec}`).not.toMatch(/(?:^|\/)(server|net)(\/|$)/);
      }
    }
  });

  it('the wire protocol stays free of runtime sim/server imports (types only)', () => {
    const src = readFileSync(join(repoRoot, 'src', 'net', 'protocol.ts'), 'utf8');
    const valueImports = [...src.matchAll(/^import\s+(?!type\b)[^;]*from\s*['"]([^'"]+)['"]/gm)].map((m) => m[1]);
    expect(valueImports, `protocol.ts value-imports: ${valueImports.join(', ')}`).toEqual([]);
  });
});

describe('architecture: src/world_api is a pure seam', () => {
  it('world_api imports only sim types and siblings', () => {
    const files = walk(worldApiRoot);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const src = stripComments(readFileSync(file, 'utf8'));
      for (const spec of importsOf(src)) {
        const ok = spec.startsWith('.') || spec.startsWith('../sim');
        expect(ok, `${file} imports ${spec}`).toBe(true);
        expect(spec, `${file} imports ${spec}`).not.toMatch(/^three($|\/)/);
      }
    }
  });
});
