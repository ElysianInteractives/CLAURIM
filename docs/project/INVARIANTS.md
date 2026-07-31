# Hard invariants

Each has an enforcing check. Weakening one requires a DECISIONS.md entry.

| # | Invariant | Enforcement |
|---|---|---|
| I-1 | `src/sim/` imports no three/render/ui/game/net/headless | `tests/architecture.test.ts` |
| I-2 | `src/sim/` touches no DOM/browser globals | same |
| I-3 | No `Math.random` / `Date.now` / `performance.now` in sim | same |
| I-4 | Same seed + same inputs = identical serialized state | `tests/sim_core.test.ts` determinism suite |
| I-5 | Save load-replay matches original run | same ("replay from a mid-run save") |
| I-6 | Content registry validates clean | `tests/sim_core.test.ts` + `npm run validate` (in build/gate) |
| I-7 | Save schema changes ship with a migration + test | `tests/save.test.ts` (migration exemplar pins the path) |
| I-8 | Corrupt/newer saves are rejected, never half-loaded | `tests/save.test.ts` |
| I-9 | `world_api` imports only sim types/siblings | `tests/architecture.test.ts` |
| I-10 | Terrain purity: one heightfield for sim+render+nav | by construction (single `terrainHeight`); regression via nav tests |
| I-11 | Quest logic is data-interpreted, not inline conditionals | review + `tests/quest_playthrough.test.ts` exemplar |
| I-12 | Derived stats written only by `recalcActorStats` | review; violation shows up as desync in determinism suite |
| I-13 | IP boundary: no proprietary names/text/assets | review + THIRD_PARTY_NOTICES.md + `scripts/check_ip.ts` (in validate/gate) |
| I-14 | render/ui never import Sim/SimWorld/ClientWorld/server concretely | `tests/architecture.test.ts` |
| I-15 | sim never imports server or net layers | same |
| I-16 | `new Date(` banned in sim alongside other wall-clock reads | same |
| I-17 | Wire protocol has no runtime sim/server imports (types only) and validates all inbound messages | same + `tests/server_net.test.ts` |
| I-18 | Clients never send positions; server movement derives from validated intent through sim collision | protocol shape + `tests/server_net.test.ts` |
| I-19 | Per-character isolation: inventories, journals, dialogue/shop sessions never cross characters | `tests/multiplayer_sim.test.ts` |
| I-20 | Encounter scaling locks at engage; wipe/leash resets deterministically | same |
| I-21 | Character + world persistence reject corrupt payloads; migrations tested for every schema bump | `tests/save.test.ts` + `tests/server_net.test.ts` |
| I-22 | Multiplayer determinism: same seed + same input streams = identical world | `tests/multiplayer_sim.test.ts` + server replay test |
| I-23 | The `src/sim` module import graph remains acyclic | `tests/architecture.test.ts` |
| I-24 | A representative four-player dungeon snapshot stays below 32,000 UTF-8 bytes | `tests/server_net.test.ts` |

Open QA gaps and future tripwires are tracked in `DEFICIT_REGISTER.md`.
