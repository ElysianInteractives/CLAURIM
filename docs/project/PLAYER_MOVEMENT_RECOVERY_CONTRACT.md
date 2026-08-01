# Player movement and recovery contract

QA Phase A locks camera-relative movement, sprint exhaustion, and a bounded
escape from invalid terrain. The authoritative sim owns every outcome; the
online client may only predict the same deterministic movement rules.

## Camera-relative movement

- `W` and `S` move along the camera's ground-plane forward axis.
- `A` and `D` move along the camera's visible left/right axis. With yaw zero,
  the third-person camera looks toward world `+Z`, so screen-right is world
  `-X`.
- Diagonal input is normalized before speed is applied.
- `localMovementToWorld` is the single pure basis transform used by both
  `Sim` and `ClientWorld`; collision remains authoritative on the server.

## Sprint exhaustion

- Sprint speed and stamina drain require sprint intent, movement intent,
  positive stamina, and no sneak intent.
- Holding Shift while stationary neither marks the actor as sprinting nor
  suppresses stamina regeneration.
- A sprint that spends its final stamina may finish that movement tick, then
  immediately returns to walking speed while Shift remains held.
- After exhaustion, sprint cannot restart until stamina reaches 10% of the
  current maximum (and at least one tick's sprint cost). This prevents rapid
  sprint/walk oscillation near zero.
- Online snapshots replicate authoritative move speed, stamina regeneration,
  stamina, maximum stamina, and sprint state. Prediction replays pending input
  through the same rules; displayed resources remain snapshot-authoritative.

## Return to safe ground

- Escape opens Game Settings. `Return to safe ground` submits intent through
  `IWorld`; online clients never choose or send a destination.
- A living player is moved to the existing recovery point for the current
  space: an interior's exit-door staging point or Falkmoor Ruin outdoors.
- Recovery clears incompatible movement/combat interaction state through the
  established transition path. It does not restore resources, apply death
  penalties, alter inventory, or change progression.
- Recovery is rejected while dead/downed, attacking/blocking, or within 30 m
  of a living hostile in the same space.
- A successful recovery starts a 30-second simulation-tick cooldown. Rejected
  requests provide private authoritative feedback.

## Protocol and acceptance

Protocol v3 adds the `recover` command and authoritative movement state to
`SelfState`. Servers reject older protocol clients rather than guessing
missing prediction inputs.

Acceptance requires focused pure-rule, authoritative-sim, online-prediction,
server-command, HUD-markup, cooldown, hostile-rejection, and resource-
preservation tests; the full `npm run gate`; and direct browser inspection of
the Game Settings panel and recovery result.
