# Opus backlog

Labels: FABLE_REQUIRED / FABLE_REVIEW / OPUS_READY / HUMAN_DECISION / BLOCKED.
Every OPUS_READY ticket: objective, why, files to inspect, files to change,
exemplar, invariants, steps, tests, commands, acceptance, traps.

---

## OB-1 OPUS_READY - Renderer interpolation between sim ticks
Why: KL-1; smooths motion at 30 Hz sim.
Inspect: `src/main.ts` (loop), `src/render/renderer.ts` (updateActors/updateCamera).
Change: `src/render/renderer.ts` only.
Exemplar: none in-repo; standard prev/current lerp by accumulator fraction.
Outline: keep per-actor prev transform in renderer userData; `main.ts` passes
`alpha = accumulator / DT` to `render()`; lerp positions/yaw for drawing only.
Invariants: renderer stays read-only; NO sim change.
Tests: none required (visual); capture before/after screenshot to docs/screenshots.
Commands: `npm run gate`, `npm run dev`.
Accept: no stepping on fast pans; gate green.
Traps: do not lerp across space transitions (snap when spaceId changes).

## OB-2 OPUS_READY - Iron-tier weapon and armor fill (12 records)
Why: proven item schema needs catalog breadth.
Inspect: `src/sim/content/items.ts` (iron_sword, leather_cuirass exemplars),
`src/sim/content/schema.ts` validator.
Change: `src/sim/content/items.ts`, `tests/` (extend a content test), optionally
`merchant_stock` loot table.
Outline: add iron_axe, iron_dagger, iron_mace(as 'axe' type or add type -
NO: do not add weapon types; stay within sword/axe/dagger/bow), hide_* armor
set, fur_* armor set; values/weights consistent with exemplars.
Invariants: ids permanent; validator passes; no combat-formula edits.
Commands: `npm run validate && npx vitest run tests/sim_core.test.ts`.
Accept: validate green, items purchasable in shop, gate green.
Traps: `weaponType` governs skill/slot behavior; a new weaponType is
FABLE_REQUIRED (attack timing decisions).

## OB-3 OPUS_READY - Wall-aware projectiles in interiors
Why: KL-6.
Inspect: `src/sim/combat/combat.ts` tickProjectiles, `src/sim/world/spaces.ts`.
Change: `src/sim/combat/combat.ts`.
Outline: in interiors, kill a projectile when `bodyFitsInRooms(layout, nx, nz, 0.05)`
is false (import via spaces helpers through a ctx.ground-style seam: add a
`ctx.isProjectilePassable(spaceId,x,z)` callback in `sim_context.ts` + `sim.ts`).
Invariants: SimContext is append-only; determinism suites stay green.
Tests: add to `tests/sim_core.test.ts`: bolt fired at a mine wall despawns
without damaging an actor behind it.
Accept: new test green, all suites green.
Traps: keep the exterior ground check unchanged.

## OB-4 OPUS_READY - Perk expansion within existing hooks (10 perks)
Why: tree depth. Inspect: `src/sim/content/magic.ts` PERKS (bladesman chain),
`src/sim/progression/skills.ts`.
Change: content/magic.ts + a validation test.
Outline: 2-3 tier chains for archery/sneak/block/lightArmor/restoration using
ONLY existing StatKeys.
Traps: a perk needing a new StatKey or trigger (e.g. "power attacks cost
less") is FABLE_REVIEW - the modifier system may need a new stat.

## OB-5 OPUS_READY - Marsh-rat den: second cave using proven primitives
Why: prove dungeon repeatability (the "second exemplar" extensibility test).
Inspect: `content/world.ts` (duskhollow rooms/spawners/doors), `tests/navigation.test.ts`.
Change: content/world.ts (+space, door pair, spawners, container), navigation
test clone for the new layout.
Accept: validator + new nav test green; enterable in-game.
Traps: unique ids; door targetYaw; add rooms so corridors are >= 3 m wide.

## OB-6 OPUS_READY - Guard test: renderer/ui never import Sim
Why: INVARIANTS gap (I-1 mirror).
Inspect: `tests/architecture.test.ts`.
Change: same file; scan `src/render`+`src/ui` for `from '../sim/sim'` /
`from '../game/sim_world'` imports; allowlist nothing.
Accept: guard green now, red when violated (prove by temp edit).

## OB-7 OPUS_READY - HUD target frame
Why: combat readability. Inspect: `hud.ts`, `world_read.ts` ActorView.
Change: `src/ui/hud.ts` only (IWorld already exposes actor health).
Outline: nearest hostile living actor within 20 m and rough facing => name +
health bar under the crosshair.
Traps: renderer/ui stay read-only; no new sim queries needed.

## OB-8 FABLE_REVIEW - NPC cross-space schedule travel (KL-4)
Door-transition pathfinding for NPCs touches brain + spaces + doors; design
sketch exists in brain.ts NOTE. Opus may draft behind the existing seams;
Fable reviews the state-machine change.

## OB-9 FABLE_REQUIRED - Weather system in sim (state, perception/movement
hooks, render fx), audio architecture, crafting systems, follower package,
crime/bounty, dragon flight architecture, multi-region streaming, GLB asset
pipeline. Do not start these from a ticket; they need design.

## OB-10 HUMAN_DECISION - Name check ("Claurim" trademark search), license
choice for the repo (MIT vs proprietary), distribution target (itch/steam/web),
art direction sign-off once the GLB pipeline is proposed.

## OB-11 OPUS_READY - Content test template
Why: every new content family PR should extend one table-driven test.
Inspect: `tests/sim_core.test.ts` content block.
Change: new `tests/content_catalog.test.ts`: for each item/actor/spell,
assert exemplar-derived sanity (weapon damage in [1,40], values >= 0, loot
tables non-empty, every merchant stockTable resolves, every dialogue entry
reachable).
Accept: green; deliberately breaking a record turns it red.
