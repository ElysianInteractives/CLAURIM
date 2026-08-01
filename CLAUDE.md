# Claurim

A browser-playable, third-person, SERVER-AUTHORITATIVE multiplayer action
RPG in an original northern fantasy province: one deterministic TypeScript
simulation core, multiple hosts (dedicated server, offline browser,
headless). Clean-room project: original code, original content, no
proprietary Bethesda assets, text, or data (automated gate:
`scripts/check_ip.ts`; rules: `docs/project/IP_STYLE_GUIDE.md` +
`NAMING_GUIDE.md`). Stack: TypeScript (ESM, strict) - Three.js - ws - Vite 8 -
Vitest 4. Supported Node: `^20.19.0 || >=22.12.0` (D-032).

MULTIPLAYER AUTHORITY (D-013..D-016): the SERVER sim resolves all persistent
outcomes (damage, death/downed, loot, quests, XP, inventory, trade,
targeting, spawns, positions). Clients send INTENT only (never positions),
predict their own movement, smooth remotes, and use D-031 host-only render
interpolation for observed transforms. Per-player state
(journal, dialogue, shop, spells, container loot) is keyed by CharacterId in
the one shared Sim - never clone the world per client.

## Repo map
| Path | What it is |
|---|---|
| `src/sim/` | **Deterministic game core, the source of truth.** No DOM/Three imports; runs in browser and Node identically. Guarded by `tests/architecture.test.ts`. |
| `src/sim/content/` | Data-as-code: items, effects, spells, perks, actors, loot, spaces, props, doors, spawners, containers, quests, dialogue. Validated by `schema.ts` (`validateContent`). |
| `src/sim/world/` | Terrain heightfield (pure fn of x,z,seed), spaces/interiors, cells/streaming, collision. |
| `src/sim/navigation/` | Grid A* over the shared walkability queries. |
| `src/sim/{combat,effects,ai,quests,dialogue,inventory,progression,actors}/` | System modules: FUNCTIONS behind the `SimContext` seam (`src/sim/sim_context.ts`); state lives on `Sim`. |
| `src/sim/save/` | Save envelope, schema version, migration registry, corruption rejection. |
| `src/sim/sim.ts` | The coordinator: tick-phase order, context binding, player commands, save/load. Do not grow it with system logic. |
| `src/world_api/` | `IWorld`: the ONLY seam render/ui/hosts use. Facets: `world_read`, `player_intent`, `menus`. |
| `src/game/` | Host glue: `sim_world.ts` (Sim -> IWorld adapter; the only host file that may import Sim), input/host action dispatch, and browser audio. |
| `src/render/` | Three.js renderer. Observes IWorld + content data; never mutates the world. |
| `src/ui/` | DOM HUD + menus. Observes IWorld, submits intent. |
| `src/headless/` | Headless host (`npm run headless`) + `mp_bench.ts` (bot-party difficulty measurement, `npm run mp:bench`). |
| `src/net/` | Wire protocol v5 (`protocol.ts`, validated both ways, NO runtime sim imports) + `client_world.ts` (online IWorld: snapshots, prediction, reconciliation). |
| `src/server/` | `core.ts` (transport-agnostic authoritative server), `ws_host.ts` (`npm run server`, :8787), `storage.ts` (StorageProvider + FileStorage; server owns online persistence). |
| `tests/` | Vitest: architecture guards, determinism, save/migrations, quest e2e, navigation, combat. |
| `scripts/` | `validate_content.ts` (content gate), `make_standalone.mjs` (single-file build). |
| `docs/project/` | Charter, architecture, locked decisions/contracts (including audio presentation and toolchain security), deficit register, QA baseline, responsibility map, backlog, and coverage matrix. Read `MODEL_HANDOFF.md` first in a new session. |

## Commands
- `npm run dev` - Vite dev server on :5173. Offline by default; online:
  open `/?ws=ws://localhost:8787` and authenticate (one tab per client).
- `npm run server` - authoritative server on :8787 (env: CLAURIM_PORT,
  CLAURIM_DATA_DIR; SIGINT persists + clean shutdown).
- `npm run mp:bench` - measured dungeon difficulty (bot parties 1/3/5).
- `npm test` - Vitest. Prefer one file while iterating: `npx vitest run tests/sim_core.test.ts`.
- `npm run typecheck` - `tsc --noEmit` (fast; run liberally).
- `npm run validate` - content gate.
- `npm run headless` - headless run (`-- ticks=9000 seed=42`).
- `npm run qa:ws` - real two-client WebSocket smoke against a running server.
- `npm run audit:deps` / `npm run audit:prod` - networked full and
  production-only advisory checks (D-032; deliberately separate from gate).
- `npm run gate` - the full pre-done gate: validate + typecheck + tests + build. Run before calling ANY change done.

## Architecture (load-bearing)
- **One sim, many hosts.** `src/sim/` must behave identically in every host. The sim is a fixed **30 Hz** tick (`DT = 1/30`, `src/sim/types.ts`).
- **Determinism.** ALL randomness flows through `Rng` (`src/sim/rng.ts`) or the stateless coordinate hashes. Never `Math.random`, `Date.now`, `performance.now` in sim code. Same seed + same inputs = same world, byte for byte (pinned by `tests/sim_core.test.ts` determinism suite).
- **`IWorld` is the only seam.** `src/render/` and `src/ui/` talk only to `IWorld`. New render/ui data or action: add to the matching facet in `src/world_api/`, implement in `SimWorld`, consume via the interface. The renderer may additionally read content DATA and the pure terrain functions (it samples the same heightfield the sim uses; they may never disagree).
- **The sim is authoritative.** Combat, loot, quest credit, trade, and AI outcomes resolve in sim modules. The renderer/UI never decide outcomes.
- **SimContext seam.** System modules hold functions only; backing state stays on `Sim`, exposed as live views on `SimContext`. Append-only: add callbacks, never repurpose.
- **Terrain purity.** `terrainHeight(x, z, seed)` is pure. Collision, navigation, spawning, and the renderer all sample it. A terrain edit is a sim edit: run the nav + terrain tests.

## Invariants, YOU MUST keep these
- `src/sim/` has zero DOM/browser/Three.js imports and never imports `render/`, `ui/`, `game/`, `net/`, `headless/` (guarded by `tests/architecture.test.ts`).
- No unseeded randomness or wall-clock reads in sim code (same guard).
- Every content record passes `validateContent` (`npm run validate`; also enforced in tests and build).
- Save compatibility: bump `SAVE_SCHEMA_VERSION` AND add a migration + test for any change to the save shape (`src/sim/save/save.ts`, `tests/save.test.ts`). Loads must reject, never half-load.
- Entity ids and content ids are stable identifiers; never renumber or reuse released ids.
- IP boundary: NO Bethesda names, dialogue, lore text, maps, or assets. Original content only. Track any external asset in `THIRD_PARTY_NOTICES.md` with license + provenance.
- Never commit secrets. Keep the runtime dependency set tiny (currently:
  Three.js and `ws`; development: Vite/Vitest/tsx/TypeScript/types only).

## Conventions
- ESM + TypeScript strict. 2-space indent. Small modules behind existing seams; never grow `sim.ts`, `renderer.ts`, `hud.ts`, or `main.ts` with new subsystem logic - add a sibling module.
- Data-as-code tables are exempt from module-size pressure; do not "modularize" data.
- New sim SYSTEM: its own module using `SimContext`. New content family: extend `content/schema.ts` + `validateContent` + a validation test in the same change.
- Extract on the rule of three. Fix bugs test-first: reproduce with a failing test, then the smallest green change.
- Commits: Conventional Commits with scope (`feat(quests): ...`) and a short body (what + why).

## Testing and verification
- `sim/` changes ALWAYS get a test. Quest/dialogue content gets an e2e drive (see `tests/quest_playthrough.test.ts` as the exemplar).
- Determinism/replay/save round-trip suites must stay green; they are the online-mode and mod-support insurance.
- Visual changes: run `npm run dev`, inspect, and capture a screenshot into `docs/screenshots/` before calling it done. Do not claim visual results without looking.
- Before declaring done: `npm run gate`.

## Model allocation (Fable vs Opus)
- Architecture, new seams, save-schema changes, combat/AI/quest RUNTIME changes, cross-domain refactors: Fable (or careful review).
- Content records following an existing exemplar, new tests from templates, UI panels in the existing family, doc updates: Opus-ready. See `docs/project/OPUS_BACKLOG.md` for ticket format; every ticket lists files, exemplar, tests, and acceptance.
- Definition of done, for every task: objective met, tests added/updated, `npm run gate` green, docs/backlog updated when a pattern changed, no invariant weakened.
