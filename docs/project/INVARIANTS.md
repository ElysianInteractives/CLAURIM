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
| I-13 | IP boundary: no proprietary names/text/assets | review + THIRD_PARTY_NOTICES.md |

Missing guards to add (OPUS_BACKLOG has tickets): circular-dependency check
across sim modules; a grep-guard for `new Date(` in sim; renderer no-Sim-import
guard (currently only convention + review).
