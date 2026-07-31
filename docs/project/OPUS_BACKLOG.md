# Opus backlog

Labels: FABLE_REQUIRED / FABLE_REVIEW / OPUS_READY / HUMAN_DECISION / BLOCKED.
Every OPUS_READY ticket: objective, why, files to inspect, files to change,
exemplar, invariants, steps, tests, commands, acceptance, traps.

---

# Multiplayer-era tickets (2026-07-31 pivot)

## OB-M1 OPUS_READY - Explicit party commands (invite/leave) on the party model
Why: milestone auto-party ('fellowship') must become player-controlled.
Inspect: `src/sim/sim.ts` (joinParty/partyOf/partyMembersOf, DEFAULT_PARTY),
`src/net/protocol.ts` (CommandKind), `src/server/core.ts` handleCommand,
`tests/multiplayer_sim.test.ts` party suite.
Change: sim.ts (partyInvite/partyLeave methods, pending-invite map),
protocol.ts (+2 command kinds + validation), core.ts (dispatch), hud.ts
(invite prompt rows), tests.
Exemplar: existing joinParty + the cmd dispatch table.
Invariants: I-19 (per-char isolation), D-020 credit rules unchanged; party
state persists in world save (extend serialize/load symmetric to parties).
Tests: invite/accept/leave; credit follows the NEW party; save round-trip.
Commands: `npx vitest run tests/multiplayer_sim.test.ts`, `npm run gate`.
Accept: two characters can form/leave a party in a server test.
Traps: do not let a character be in two parties; keep DEFAULT_PARTY only as
new-character fallback.

## OB-M2 OPUS_READY - Chat input box in the HUD
Why: KL-16; the chat plumbing (cmd + event + feed render) already works.
Inspect: `src/ui/hud.ts` (feed + CSS), `src/game/input.ts` (Enter key),
`src/world_api/player_intent.ts` chat().
Change: hud.ts (input row toggled by Enter, calls world.chat), input.ts
(Enter opens, Escape closes; suppress game keys while typing).
Invariants: renderer/ui observe IWorld only; 200-char limit already enforced
server-side.
Accept: type -> appears in both clients' feeds (manual two-tab check +
screenshot). Fable review: no.

## OB-M3 DONE - Snapshot bandwidth guard test
Why: KL-14 needs a tripwire before entity growth.
Inspect: `src/server/core.ts` broadcastSnapshots, `tests/server_net.test.ts`.
Change: new test: JSON.stringify(snapshot).length < 32_000 with 4 clients +
the mine populated; log actual size.
Result: Plan 0 added the four-client mine test; baseline max is 8,077 UTF-8
bytes against the 32,000-byte limit.

## OB-M4 OPUS_READY - Veteran variants for wolves and thralls
Why: encounter breadth on the proven tier/role/ability schema.
Inspect: `src/sim/content/actors.ts` (redclaw_reaver exemplar).
Change: actors.ts (+frostfang_alpha with a frontal_cone howl-swipe,
+barrow_sentinel with ground_aoe), world.ts (one spawner each in sensible
spots), content tests.
Invariants: validator green; NEW ability KINDS are FABLE_REVIEW - use
existing kinds only.
Accept: `npm run validate` + mp:bench still shows solo-viable overworld.

## OB-M5 OPUS_READY - Reconnect-while-downed policy test
Why: pin the edge: disconnect while downed must not dodge death.
Inspect: `src/sim/sim.ts` extractCharacter (downed -> release-health rule),
`tests/server_net.test.ts` reconnect suite.
Change: add test: down a character, disconnect, reconnect; expect released
state (alive, reduced resources, at recovery point or stored pos).
Accept: documents + pins the policy; no sim change unless the test exposes a
real hole (then FABLE_REVIEW).

## OB-M6 FABLE_REVIEW - Blocking/interrupting bot policy for mp_bench
Smarter bots (block telegraphs, spread from cleaves, prioritize matron/
thralls, actually revive) to bound difficulty from above. Policy code is
mechanical; reviewing the resulting balance conclusions is Fable's.

## OB-M7 FABLE_REQUIRED - Accounts + authentication service (KL-11),
dungeon instancing, delta-encoded snapshots, guild/trade/matchmaking
systems, multi-realm sharding. Do not start from tickets; these need design.

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

## OB-3 DONE - Wall-aware projectiles in interiors
Result: Plan 2 added a swept `projectileObstruction` SimContext query covering
terrain, implicit room walls, and solid prop AABBs, plus earliest swept actor
selection. Focused pillar and room-wall reproductions pass in
`tests/combat_correctness.test.ts`.

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

## OB-6 DONE - Guard test: renderer/ui never import Sim
Why: INVARIANTS gap (I-1 mirror).
Inspect: `tests/architecture.test.ts`.
Change: same file; scan `src/render`+`src/ui` for `from '../sim/sim'` /
`from '../game/sim_world'` imports; allowlist nothing.
Result: enforced by the existing host-boundary suite in
`tests/architecture.test.ts`.

## OB-7 DONE - HUD target frame
Result: Plan 2 added a facing-selected hostile target name/tier/accessible
health meter, with pure selector/render tests. It consumes existing ActorView
position/health and remains read-only.

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
