# Third-party notices and asset provenance

## Dependencies (code, via npm)
- three (MIT) - 3D rendering. https://github.com/mrdoob/three.js
- Dev-only: vite (MIT), vitest (MIT), typescript (Apache-2.0), tsx (MIT),
  @types/* (MIT).

## Algorithms
- Seeded RNG in `src/sim/rng.ts` uses a splitmix32-style mixing construction
  (public-domain family of integer hash constructions). Implementation is
  original to Claurim.
- Value/fbm noise: standard public techniques; original implementation.

## Architectural reference
- World of ClaudeCraft (`levy-street/world-of-claudecraft`, MIT) was studied
  for architecture patterns (one-sim/multi-host, SimContext seam, guard-test
  discipline, CLAUDE.md conventions). No code, assets, or content were copied.

## Game assets
- Live game geometry remains procedural (three.js primitives) and live colors
  remain from the original palette in `src/render/palette.ts`.
- Asset Phase A0 adds the original clean-room Falkmoor Blender pilot source at
  `art/blender/falkmoor_ruins.blend` and its three GLB exports under
  `public/assets/models/environment/falkmoor/`. They were generated with the
  repository's `scripts/blender/build_falkmoor_pilot.py` and contain no
  downloaded meshes, textures, fonts, brands, or third-party source material.
  The pilot is not yet instantiated by the live renderer.
- No external art, audio, or fonts (system serif stack only) are bundled.
- All names, dialogue, lore, quest text, and place names are original Claurim
  material. This is a clean-room fan-genre project: no Bethesda code, assets,
  text, or trademarks are used.

## Adding assets (required process)
Every external asset must be listed here with: file path, source URL, author,
license, retrieval date, and any modifications. Assets without a compatible
license entry fail review.
