# AI and encounter reliability contract (D-026)

This is the exact Plan 4 behavior contract for perception, target continuity,
authored encounter ownership, ability use, schedules, return recovery, and
reset. AI remains deterministic simulation state behind `SimContext`; hosts
and renderers only present its authoritative result.

## Perception and targets

- Range, outdoor night reduction, stealth, detection, and the 140-degree
  vision cone remain D-012.
- Detection also requires an unobstructed eye-to-eye segment through the same
  world obstruction query used by projectiles. Touch range bypasses the cone,
  not walls.
- Threat hysteresis remains 1.25x while the current target is perceived.
  When it is not perceived, the highest-threat perceived candidate wins
  immediately. With no perceived candidate the actor searches the last known
  position, then returns.

## Encounter ownership

`SpawnerDef.encounterId` is the authored pull/reset key. Multiple spawners in
one space may share it. Untagged content falls back to its spawner id, and a
runtime actor without a spawner owns itself. A summon and all descendants
inherit their root owner's key.

First aggro joins every living preplaced member of that key in the same space
and locks one party-size scale across the group. The measured extra-player
curve is max health +40% and damage +8% per additional engaged player; solo
base values are unchanged.

Return arrival, unreachable-return recovery, and party wipe all call the same
atomic reset:

- remove owned summons, projectiles, and ground areas;
- restore every preplaced authored member at its valid home;
- clear attacks, effects, path/search state, threat, phases, cooldowns, and
  scaling;
- refill health, stamina, and magicka; and
- make any defeated preplaced member unlootable until defeated again.

## Ability legality

AI starts only a ready and useful ability:

- hostile cones and ground areas require a valid same-space target and line of
  sight; cones also require range;
- support heals require an actually injured allied encounter member in range;
- summons respect `maxActiveSummons`.

Cooldowns advance during telegraph/recovery frames. A low-level
`startAbility` call remains available to deterministic tests and presentation
fixtures; production AI applies the legality check before calling it.
Ground-effect ids are allocated by the owning `Sim`, never module-global.

## Navigation, schedules, and recovery

Active scheduled NPCs use a deterministic breadth-first route through authored
directed doors and physically approach each door before transitioning.
Inactive NPCs may collapse that same valid route to the schedule anchor; this
advances the resident world without simulating an unobserved commute.

Movement records consecutive no-progress ticks. A returning actor with a
provably unreachable static home recovers after 90 blocked ticks to the
nearest traversable home point, then invokes the normal atomic reset. This is
recovery only; combat movement never teleports around a temporary obstacle.

## Enforcement and evidence

- `tests/ai_encounter_reliability.test.ts` pins wall-aware perception, visible
  target continuity, multi-spawner pulls, useful support casts, cooldown
  progress, summon caps, transient/group reset, observed and offscreen schedule
  transitions, and disconnected-home recovery.
- `npm run ai:bench` compares fixed-seed naïve and mechanics-aware policies.
  The latter reacts to pools/telegraphs, blocks, spreads, prioritizes adds, and
  revives; results are evidence bounds, not a replacement for human play.
- The full gate and Plan 4 browser mechanic-readability checks are recorded
  in `QA_BASELINE.md`; the benchmark, not the visual fixture, supplies clears.
