# Third-person camera contract

QA Phase D locks a readable over-the-shoulder camera without changing combat
authority, player aim intent, projectile behavior, movement, or protocol v5.

## Composition and aim

- The center reticle remains fixed at the viewport center.
- Third person uses a `0.9 m` right-shoulder offset. At yaw zero, camera-local
  screen-right is world `-X`, matching the locked camera-relative movement
  basis. The local player therefore appears left of the reticle.
- Camera forward is always the normalized `reticleDirection(yaw, pitch)` from
  D-034. The third-person camera and authoritative player ray use different
  origins but exactly the same direction; presentation cannot rewrite aim.
- First person remains at the player eye and uses that same yaw/pitch
  orientation, with the local body hidden.

## Obstruction and close geometry

- The desired position is the player eye minus the trailing aim vector plus
  the shoulder offset. The complete diagonal eye-to-camera segment is tested
  through the shared `worldObstructionT` query with the existing `0.22 m`
  camera padding.
- An obstruction retracts both trailing distance and shoulder offset by one
  shared scale, preserving composition instead of sliding only one axis
  through geometry. The camera retains `0.2 m` clearance before the hit.
- Terrain still supplies a `0.4 m` minimum camera height.
- When obstruction compresses the trailing distance below `1.1 m`, the local
  body is hidden for that frame so the head cannot reclaim the reticle or clip
  across the near plane. It reappears automatically when clearance returns.

## Authority boundary

The camera module is pure presentation geometry. It submits no destination,
target, hit, projectile origin, or collision result. Simulation and server
authority continue to consume only bounded yaw/pitch intent under D-034.

## Acceptance

Acceptance requires deterministic shoulder separation, exact forward-ray
parity at arbitrary yaw/pitch, whole-boom obstruction compression, close-wall
body visibility rules, the complete `npm run gate`, and direct 1280x720 plus
1920x1080 browser evidence showing a clear reticle with no overflow or browser
warnings/errors.
