# NPC schedule stability contract

QA Phase F locks route-complete scheduled movement and presentation dead zones
without changing combat steering, protocol v5, saves, or authored schedules.

## Scheduled movement

- Static schedule and encounter-return goals require either a fully walkable
  line or a complete A* path from the actor's exact current position.
  Endpoint walkability alone is insufficient.
- When no complete route exists, scheduled NPCs submit no movement. Collision
  sliding is not treated as navigation progress and the stuck counter advances.
- After 60 blocked schedule ticks, the NPC adopts its last actually reached,
  traversable schedule home as a stable substitute. The substitute persists
  until the authored schedule entry changes or a wander timer retargets.
- Cross-space schedules still use the validated directed door graph. Inactive
  actors may still collapse a valid unobserved commute under D-026.
- Every consecutive authored schedule leg must route from its exact start to
  either the next goal or the first required door.

## Scope boundary

Combat, flee, and search continue to use their existing local collision
steering when A* cannot supply a complete route. This keeps D-017/D-018
encounter pressure unchanged while eliminating the civilian schedule defect.

## Presentation

- Host posing derives locomotion from observed horizontal speed rather than a
  raw per-frame displacement bit.
- Idle-to-walk requires at least `0.18 m/s`; walk-to-idle stops below
  `0.08 m/s`. This hysteresis prevents tiny interpolation/collision corrections
  from triggering the 6 cm bob and 0.4 rad arm swing.
- Locomotion history is renderer-owned and never enters simulation, saves,
  snapshots, or input.

## Development QA shift

The development-only `?qa=inn-shift-change` start sets the offline clock just
before 21:00 and positions the camera to observe Maera's work-to-sleep move.
Production and online clients ignore named QA starts under D-037.

## Acceptance

Acceptance requires disconnected-route no-slide/fallback tests, all authored
schedule-leg reachability, locomotion dead-zone tests, existing Plan 4
schedule/recovery coverage, `world:tour`, `ai:bench`, the full `npm run gate`,
and direct before/settled browser evidence at 1280x720 and 1920x1080 with no
overflow or warning/error logs.
