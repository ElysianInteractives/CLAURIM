# Opus backlog

Labels: FABLE_REQUIRED / FABLE_REVIEW / OPUS_READY / HUMAN_DECISION / BLOCKED.
Every OPUS_READY ticket: objective, why, files to inspect, files to change,
exemplar, invariants, steps, tests, commands, acceptance, traps.

---

# Multiplayer-era tickets (2026-07-31 pivot)

## OB-M1 DONE - Explicit party commands on the party model
Plan 7 replaces automatic `fellowship` membership with D-029: solo starts;
nearby invite, accept, decline, and leave; a five-member cap; private status
feedback; durable membership/offline frames; and save v2->v3 migration that
disbands the legacy global party. Tests pin party exclusivity, distance,
stale invites, reconnect/restart storage, revive access, quest/loot behavior,
and party-only first-engage scaling.

## OB-M2 DONE - Chat input box in the HUD
Plan 7 adds the focused Enter/Send/Escape composer, suppresses game input while
typing, stabilizes interactive HUD nodes, and fixes command-to-tick chat event
loss. The authoritative path sanitizes controls/whitespace, caps 200 code
points, throttles at 15 ticks, and remains same-space scoped. Automated and
two-browser delivery checks pass at the supported desktop viewports.

## OB-M3 DONE - Snapshot bandwidth guard test
Why: KL-14 needs a tripwire before entity growth.
Inspect: `src/server/core.ts` broadcastSnapshots, `tests/server_net.test.ts`.
Change: new test: JSON.stringify(snapshot).length < 32_000 with 4 clients +
the mine populated; log actual size.
Result: Plan 0 added the four-client mine test; baseline max is 8,077 UTF-8
bytes against the 32,000-byte limit.

## OB-M4 DONE - Veteran variants for wolves and thralls
Plan 8 adds Rimehowl Alpha and Barrow Sentinel through the proven veteran,
frontal-cone, and ground-AoE schemas. Their authored spawners, factions, loot,
ability shapes, prepared-solo check, current group benchmark, browser
telegraphs, and full gate pass without adding an ability kind.

## OB-M5 DONE - Reconnect-while-downed policy test
Plan 7 pins the existing extract/restore policy: disconnecting while downed
returns the character standing at 40% health, never linkdead or incapacitated.

## OB-M6 DONE - Blocking/interrupting bot policy for mp_bench
Plan 4 adds named naïve/mechanics policies plus `npm run ai:bench`.
Mechanics bots pre-move targeted pools, spread on approach, block late
telegraphs/basic boss swings, prioritize summons, and revive. Output records
policy, blocks, damage, downs, revives, interrupts, phases, wipes, and kills.

## OB-M7 PARTIAL - Live-service platform systems
Plan 6 delivers the bounded account/password, rotating session, ownership,
transport, and browser sign-in boundary in D-028. Recovery/MFA, identity
operations, dungeon instancing, delta-encoded snapshots,
guild/trade/matchmaking, and multi-realm sharding remain FABLE_REQUIRED; do
not start those systems from tickets without a new lock.

---

## OB-1 DONE - Renderer interpolation between sim ticks
Plan 9 locks D-031: the browser renderer uses previous/current actor
transforms and the fixed-step accumulator for position and shortest-arc yaw.
First observations, space changes, and jumps over 4 m snap. Camera, terrain
streaming, actor meshes, and caster-anchored telegraphs share the same
displayed transform; unit and browser acceptance pass without sim/protocol
changes.

## OB-2 DONE - Iron-tier weapon and armor fill (12 records)
Plan 8 adds four weapons and hide/fur armor sets without a new weapon type or
combat formula. All twelve records are guaranteed in `merchant_stock`; the
catalog test verifies the link and browser QA completes an Iron Axe purchase.

## OB-3 DONE - Wall-aware projectiles in interiors
Result: Plan 2 added a swept `projectileObstruction` SimContext query covering
terrain, implicit room walls, and solid prop AABBs, plus earliest swept actor
selection. Focused pillar and room-wall reproductions pass in
`tests/combat_correctness.test.ts`.

## OB-4 DONE - Perk expansion within existing hooks (10 perks)
Plan 8 adds two-tier or three-tier archery, sneak, block, light-armor, and
restoration chains using only existing modifier hooks. Tests pin same-skill,
increasing, acyclic prerequisites and prove the archery chain reaches the
derived-stat modifier path.

## OB-5 DONE - Siltroot Burrow second cave
Plan 8 proves the interior pattern with five connected rooms/corridors, a
two-way exterior door, two rat encounters, and the Rootbound Cache. The
catalog validator, exact entrance-to-brood navigation test, all-space tour,
and 1280/1920 browser checks pass.

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

## OB-8 DONE - NPC cross-space schedule travel (KL-4)
Plan 4 uses deterministic directed-door breadth-first routes. Observed NPCs
approach and transition at each door; inactive residents collapse only a valid
route to the scheduled anchor. Both modes have focused tests.

## OB-9 FABLE_REQUIRED - Weather system in sim (state, perception/movement
hooks, render fx), final audio asset/spatial-source pipeline, crafting systems,
follower package, crime/bounty, dragon flight architecture, multi-region
streaming, GLB asset pipeline. Do not start these from a ticket; they need
design.

## OB-10 HUMAN_DECISION - Name check ("Claurim" trademark search), license
choice for the repo (MIT vs proprietary), distribution target (itch/steam/web),
art direction sign-off once the GLB pipeline is proposed.

## OB-11 DONE - Content test template
Plan 8 adds `tests/content_catalog.test.ts`, covering numeric envelopes,
item/loot/merchant/actor/modifier references, perk graphs, dialogue reach,
host-neutral space labels, veteran ability shapes, a real modifier-chain
hook, and a deterministic prepared-solo encounter check.
