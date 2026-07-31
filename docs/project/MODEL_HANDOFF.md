# Model handoff - read this first in a new session

## State as of 2026-07-30 (Fable bootstrap session)
The Kaldwyn Reach vertical slice is implemented and tested:
- Deterministic 30 Hz sim core with guard tests (52+ tests green: run `npm test`).
- World: authored 1 km exterior (ruin -> road -> Fenharrow -> Duskhollow Mine),
  2 interiors, cells/streaming, collision, A* navigation.
- Gameplay: melee/ranged/spell combat with phase state machines, blocking,
  sneak attacks, modifier/effect system, use-based skills + perks, inventory/
  equipment/loot/merchant, NPC AI (perceive/combat/search/flee/return +
  schedules), quest + dialogue runtimes.
- The Hollow Delve quest end-to-end (with save/load at every stage boundary,
  pinned by tests/quest_playthrough.test.ts).
- Save schema v1 + migration framework + corruption rejection.
- Browser host (Three.js renderer, HUD, input), headless host (~50k ticks/s).
- `npm run gate` = validate + typecheck + tests + build: green at handoff.

## How to continue
1. Read CLAUDE.md (contract), DECISIONS.md (locked), INVARIANTS.md.
2. Pick work from OPUS_BACKLOG.md respecting labels.
3. Every change: tests + `npm run gate` before done.
4. Never weaken a guard test to make something pass.

## Session verification evidence
- Tests: 5 files, 52 tests passing (vitest run, this session).
- Headless: `npm run headless -- ticks=3000` => ~50k ticks/s, sim stable.
- Build: vite production build 559 kB (147 kB gzip).
- Visual: sandbox had no browser (KL-7); a standalone single-file build
  (`npm run standalone`) exists for file:// inspection; first-render QA
  is the top verification priority for the next session with a browser.

## Watch items for the next model
- The renderer has had at most one visual inspection; expect polish issues
  (see KNOWN_LIMITATIONS). Do not assume art quality is final; the palette
  and silhouettes are the locked direction, not the final asset quality.
- `terrain_mesh.ts` has a triple-duplicated `mesh.position.set` line
  (harmless; clean up on next touch).
- `sim_world.ts` holds a `void countItem` keep-import; remove when a real
  use lands.
- Balance numbers (damage, xp curves) are first-pass; tune only with
  headless measurement, not by feel.
