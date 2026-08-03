# Architecture

Read CLAUDE.md first; this file adds the diagrams-in-prose and rationale.
Locked decisions: DECISIONS.md. Invariants: INVARIANTS.md.

## Layering
```
content (data-as-code)      docs
        |
      src/sim  <- deterministic core: world, actors, combat, effects, AI,
        |         navigation, quests, dialogue, inventory, progression, save
   src/world_api (IWorld: world_read / player_intent / menus facets)
        |
  +-----+---------+----------------+
  |               |                |
src/game       src/render       src/ui        src/headless
(SimWorld       (Three.js,       (DOM HUD      (Node host,
 adapter,        observes         + menus)      scripted runs)
 input)          IWorld+data)
        \          |             /
         \         |            /
          src/main.ts (browser host loop: 30 Hz fixed step + rAF render)
```

## The tick (Sim.tick)
1. clear events; advance tick counter
2. player: stance flags, movement (axis-slide collision), jump/gravity,
   interact cooldown
3. per actor ascending id: effects (DoT/HoT/expiry) -> brain maintenance
   (cooldowns/threat and inactive schedule abstraction; full decisions only in
   an active window) -> attack state machine -> regen
4. projectiles step + hit
5. every 10 ticks: positional reach objectives; every 300: respawn checks

Determinism notes: actor iteration is id-ordered; all rng draws go through the
one Rng stream (plus forked child streams for spawner placement and merchant
stock, keyed by stable ids) so event-order changes cannot silently reshuffle
unrelated rolls.

## Spaces, cells, streaming
Exterior `kaldwyn` is a 1024x1024 m authored region; interiors are separate
spaces with flat floors and room-rect layouts. Cells are 64 m; the 5x5 block
around the player is "active": AI ticks there, terrain meshes exist there.
All actors stay resident (D-004). Transitions teleport the player through
door records and emit `spaceEntered`.

Scheduled resident NPCs use the directed authored door graph. Active NPCs
walk to each door before transitioning; inactive NPCs may collapse the same
valid route to the scheduled anchor. Encounter ownership is separately
authored on spawners and resolved by pure helpers under `sim/ai`, so aggro and
`Sim`-owned wipe/reset lifecycle use one key without a reverse dependency.

## Where things resolve
- Damage: only `combat/damage` via `SimContext.dealDamage`.
- Loot: rolled once per corpse at death; containers roll once on first open;
  both persist in the save.
- Quest credit: `quests/quest_runtime.onQuestEvent` consuming SimEvents.
- Trade: `inventory/inventory.ts` buy/sell with speech-scaled prices.
- Never in: render, ui, hosts.

## Renderer contract
Reads IWorld + content data + pure terrain fns. Owns meshes/lights/camera.
Streams terrain cells, swaps space contents on `currentSpace()` change,
poses characters from ActorView state. May not import `Sim` (only
`game/sim_world.ts` may) and may not write back.

D-046 adds a renderer-owned model-quality layer: stable high/medium rig
factories, hysteretic actor/building selection, distance presentation culling,
two-tier instanced vegetation, and a validated lazy GLB/glTF replacement
registry. Selection state never enters IWorld, simulation, snapshots, saves,
collision, or navigation. See `HIGH_FIDELITY_RENDERING_CONTRACT.md`.

D-047 separates presentation clocks explicitly. Offline actors/projectiles
consume adjacent fixed-tick history; online non-local actors arrive already
interpolated from timestamped snapshot tracks and bypass that history. Camera
collision recovery and adaptive raster density are renderer-owned state and
never enter IWorld authority. See `FRAME_PRESENTATION_STABILITY_CONTRACT.md`.

D-048 keeps adaptive quality in the same renderer-only boundary. Raster
density responds first; only sustained slow timing at its floor may select
socket-compatible medium surrounding actors, a shorter building detail band,
and medium outer-cell decoration. The local player remains high detail, and
the tier never enters IWorld, collision, protocol, or saves. Query-gated
`qaPerf` telemetry observes this boundary without writing gameplay state. See
`FIND7_RENDER_HEADROOM_CONTRACT.md`.

D-049 clarifies the offline/predicted-local fixed-tick boundary: explicit
world-step observation advances adjacent history even when a transform is
unchanged, settling arrival and collision stops. Per-render sampling is
read-only for an already-current transform. Timestamped online non-local
tracks continue to bypass this history. See
`STATIONARY_PRESENTATION_SETTLEMENT_CONTRACT.md`.

D-050 adds a build-time art-source boundary outside simulation and renderer
authority. `art/asset-manifest.json` describes Blender source, GLB exports,
budgets, transforms, collider intent, and provenance;
`scripts/validate_assets.ts` parses exported binaries during the normal gate.
D-052's renderer-owned runtime catalog mirrors only the browser-safe fields,
lazy-loads validated GLBs with Meshopt/KTX2 support, coalesces and caches each
stable asset ID, and leaves a procedural prop live until replacement succeeds.
The Falkmoor pilots are active visuals; exported collider nodes never replace
content collision. See `BLENDER_ASSET_AUTHORING_CONTRACT.md` and
`ENVIRONMENT_ASSET_RUNTIME_CONTRACT.md`.

Environmental geometry is the other permitted pure-data seam: renderer props
use the same yaw/scale records as `CollisionIndex`; interior walls use
`roomBoundarySegments`; the camera reads `worldObstructionT`. These imports
query immutable content/geometry and do not expose or mutate simulation state
(D-025).

## Save
See D-009 and `src/sim/save/save.ts`. The envelope carries schemaVersion +
contentVersion + seed + rng state + full actor/quest/bookkeeping state.
Loads validate, migrate linearly, and reject rather than half-load.

## Performance envelope (Plan 0 baseline, 2026-07-31)
- Headless: 56,962 ticks/s for `ticks=9000 seed=42` on Node 26 / Windows.
- Bundle: 592.86 kB (156.62 kB gzip), three.js dominant.
- Representative four-player mine snapshots: 8,077 bytes maximum against the
  32,000-byte tripwire.
- Terrain cell build: 33x33 vertex grid + scatter; 25 cells live worst case.
- D-045 batches repeated terrain decoration per cell and locks the four named
  25-cell checkpoints to <=300 mesh draw nodes and <=40 unique geometries.
- D-046 additionally locks populated exterior presentation to <=325 visible
  mesh nodes and <=175,000 visible triangles, with per-archetype limits.
