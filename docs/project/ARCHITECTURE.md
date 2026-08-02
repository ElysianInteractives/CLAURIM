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
