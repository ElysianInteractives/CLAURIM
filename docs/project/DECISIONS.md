# Architectural decisions (LOCKED unless a defect is demonstrated)

Format: id, decision, rationale, alternatives rejected, status.

## D-001: One deterministic sim, IWorld seam, multiple hosts - LOCKED
The ClaudeCraft model, adopted after studying `levy-street/world-of-claudecraft`
(root CLAUDE.md + tests/architecture.test.ts): `src/sim/` is host-agnostic and
deterministic; `src/world_api/` (`IWorld`, per-domain facets) is the only
surface render/ui/hosts may use; outcomes resolve in the sim. Rejected:
renderer-coupled gameplay (kills headless/server hosts), ECS frameworks
(dependency weight, no proven need at this scale).
Guard: `tests/architecture.test.ts`.

## D-002: SimContext seam for system modules - LOCKED
System modules (combat, ai, quests, inventory, effects, dialogue, progression)
export functions that receive `SimContext`; state stays on `Sim` as live views.
Adopted from ClaudeCraft's proven pattern. Rejected: methods on a god-class
Sim (unreviewable growth); free-floating singletons (kills multi-sim isolation
needed for tests and future server realms).

## D-003: 30 Hz fixed tick - LOCKED
`TICK_RATE = 30` (`src/sim/types.ts`). ClaudeCraft uses 20 Hz for an MMO;
Claurim's first-person melee wants finer attack-phase granularity (windup 8 /
active 3 / recover 10 ticks at 33 ms each). 60 Hz doubles sim cost for little
gain at this combat pacing. Renderer runs at rAF and reads latest state;
interpolation is an accepted later improvement (see KNOWN_LIMITATIONS KL-1).

## D-004: Cells + activity window; actors persist, AI ticks locally - LOCKED
`CELL_SIZE = 64`, `ACTIVE_RADIUS = 2` (5x5 block). The sim keeps ALL actors in
memory (region scale makes this cheap: <100 actors; quest references stay valid
with no proxy/alias system) but ticks AI only inside the active window around
the player; the renderer streams terrain meshes per cell and disposes on exit.
Interiors are always-active while occupied. Rejected: full actor
serialization per cell (premature; adds a hard class of bugs before a second
region exists - revisit when actor count approaches ~2000 per region).

## D-005: Terrain = pure analytic authored features + fbm detail - LOCKED
`terrainHeight(x, z, seed)` is a pure function combining authored features
(mountain rim, river carve, settlement/ruin plateaus, road-bed flattening
along a control polyline) with fbm noise for detail. Every consumer samples
the same function. Rejected: stored heightmap assets (asset pipeline burden,
merge conflicts, no diffable authoring); voxel terrain (scope; revisit for
caves-with-overhangs later - interiors currently cover that need).

## D-006: Content is data-as-code with an in-repo validator - LOCKED
TS record tables in `src/sim/content/`, typed by `schema.ts`, validated by
`validateContent` (~all cross-references checked). Rejected: zod/JSON-schema
dependency (the validator is <300 lines, dependency-free, and produces exact
domain errors); JSON files (lose types, comments, and refactoring).

## D-007: Combat model: phase state machines + authoritative resolution - LOCKED
Attacks are windup/active/recover tick machines on the actor; melee resolves
once at windup end via range+arc; projectiles are simulated entities;
mitigation = armor DR (physical) -> resist channel -> block. Constants in
`types.ts`. Damage flows ONLY through `dealDamage`. Sneak attacks multiply at
resolution if the target's brain is not in combat.

## D-008: One modifier system for all stat changes - LOCKED
`StatModifier {stat, op add|mul, value, source}`; composition order
base -> adds -> muls -> clamps (`effects/modifiers.ts`). Equipment, perks,
skills, and timed effects all express through it; `recalcActorStats` is the
only writer of derived stats. Rejected: per-domain ad-hoc stat patching (the
classic irreversibility trap).

## D-009: Versioned JSON save envelope + linear migrations - LOCKED
`SAVE_SCHEMA_VERSION`, migration registry v->v+1, structural validation,
reject-never-half-load (`src/sim/save/save.ts`). Full actor snapshot rather
than delta-vs-content (simpler, correct at region scale; delta encoding is a
size optimization to revisit with streaming saves). Golden round-trip +
migration tests pinned in `tests/save.test.ts`.

## D-010: Quest/dialogue as data-interpreted state machines - LOCKED
Quests: stages -> objectives (kill/collect/talkTo/reach/interact) with
event-driven credit + polled reach; dialogue: condition-gated entries/choices
with action lists (`quest_runtime.ts`, `dialogue_runtime.ts`). No quest logic
inline in gameplay code. Exemplar: The Hollow Delve.

## D-011: Renderer style: flat-shaded low-poly primitives, palette module - LOCKED for the slice
All colors from `render/palette.ts`; characters/props are assembled
primitives; terrain is vertex-colored by biome. A GLB asset pipeline
(ClaudeCraft's image-to-glb style) is the planned upgrade path and must slot
in behind `buildCharacter`/`buildProp` without touching the sim.

## D-012: Perception model - LOCKED
Distance (template range) x night factor (outdoors 21:00-05:00: 65%) x stealth
(sneaking target: range * max(0.15, 1 - stealth*0.12) * observer detection),
140-degree vision cone beyond touch range (2.5 m; 1.0 m vs sneaking targets =
the backstab window). See `ai/brain.ts` canPerceive + `tests/navigation.test.ts`.
