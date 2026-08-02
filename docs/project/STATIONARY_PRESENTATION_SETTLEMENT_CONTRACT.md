# Stationary presentation settlement contract

QA Phase Q locks D-049 against the reporting-device `Find8.mp4` observation:
actors travel normally, but after reaching a destination their gait can
continue and the local camera can replay a final partial step against a solid.
This is presentation state, not continued authoritative movement.

## Root cause

- The fixed-tick host calls `Renderer.observeWorldStep()` after every 30 Hz
  simulation step.
- `TransformHistory.observe()` previously advanced its adjacent-tick pair only
  when the transform changed. An unchanged arrival or collision-stop tick was
  discarded, leaving the final moving `previous -> current` pair active.
- Render sampling repeatedly swept that stale pair as interpolation alpha
  cycled. Displacement-derived posing therefore stayed in locomotion, and the
  local player's camera anchor could shift even though authority was stopped.
- The same failure explains stationary NPC gait and apparent static-building
  jitter. Collision can create the stop condition but does not create the
  replay.

## Fixed-tick settlement

- Every explicit fixed-tick observation advances history, including an equal
  transform. The first unchanged tick collapses the pair to `current ->
  current`.
- Render sampling is read-only for an already-current transform. It may create
  a missing first observation or capture an out-of-band changed transform, but
  repeated render reads cannot advance or collapse a moving pair.
- Space changes and movements beyond the existing snap distance still snap
  both endpoints. Multiple simulation steps before one rendered frame still
  retain the latest two ticks.
- Online non-local actors retain their timestamped snapshot tracks and bypass
  this fixed-tick history. Offline actors, the predicted online local player,
  and projectiles retain the renderer-owned history boundary.

## Authority boundary

No movement speed, destination, schedule, path, collider, camera obstruction
result, simulation tick, protocol field, save field, or authored transform is
changed. Locomotion remains derived presentation state and is never serialized
or replicated.

## Acceptance

- A move followed by an equal authoritative tick produces the final position
  at every interpolation alpha instead of replaying the last step.
- A posed humanoid returns its locomotion flag, legs, torso sway, and vertical
  bob to idle on the next zero-displacement rendered sample.
- A collision-stopped local player retains one camera anchor across the full
  alpha range.
- Development route `?qa=thornmere-wall&qaPerf=1&qaWalk=1` continuously presses
  forward into the stable and must settle the player pose and camera after
  contact despite held input.
- Adjacent moving ticks, multiple steps per frame, teleport/space snapping,
  timestamped remote motion, and the existing camera smoother remain green.
- `npm run gate`, world/network/AI gates, direct browser arrival/wall-contact
  checks, and a reporting-device replay pass before AV-009 becomes `VERIFIED`.
