// Produce dist/claurim-standalone.html: the production build inlined into a
// single file that opens over file:// (no server needed). Used for visual QA
// on machines where the dev server is unavailable.
// Run AFTER `vite build`:  node scripts/make_standalone.mjs

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const assets = join(dist, 'assets');
const js = readdirSync(assets).find((f) => f.endsWith('.js'));
if (!js) throw new Error('no built js found; run vite build first');
const code = readFileSync(join(assets, js), 'utf8');
let html = readFileSync(join(dist, 'index.html'), 'utf8');
html = html.replace(/<script type="module"[^>]*><\/script>/, '');
html = html.replace(
  '</body>',
  `<script type="module">${code.replace(/<\/script>/g, '<\\/script>')}</script></body>`,
);
writeFileSync(join(dist, 'claurim-standalone.html'), html);
console.log('wrote dist/claurim-standalone.html', (html.length / 1024).toFixed(0) + 'kB');
