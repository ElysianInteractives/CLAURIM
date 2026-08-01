# Spell reticle aim contract

QA Phase B locks center-reticle trajectory for player projectile spells. The
client supplies bounded aim intent; the authoritative simulation still owns
release timing, projectile motion, obstruction, hits, damage, and effects.

## Aim intent

- Yaw zero points toward world `+Z`; positive pitch points upward.
- Browser pitch is clamped to `-1.35..1.1` radians at input capture, protocol
  validation, and simulation consumption.
- `reticleDirection` converts yaw and pitch into one normalized 3D direction.
- Protocol v4 requires finite pitch on every sequenced movement input. Missing
  or out-of-range pitch is a protocol violation, and clients never send a hit
  target or projectile position.
- During a spell windup, the most recent fixed-tick reticle state determines
  release direction. This permits deliberate aim adjustment before release
  without trusting a client-selected destination.

## Projectile and presentation behavior

- Player projectile spells spawn slightly along the normalized reticle ray and
  apply velocity on all three axes. Existing swept actor/world collision
  remains unchanged and authoritative.
- Self-targeted spells such as Mend Wounds do not consume a trajectory.
- NPC projectiles and bows retain their established horizontal facing behavior;
  extending reticle pitch to bows is a separate ranged-combat lock.
- The read-only HUD target frame scores hostiles against the same 3D reticle ray
  instead of a flat yaw-only cone.
- Rejected pointer-lock requests fail quietly so restricted embedded browsers
  do not produce an unhandled application error.

## Acceptance

Acceptance requires a failing horizontal-only reproduction, normalized/clamped
ray tests, pitched authoritative spell release, protocol validation, real
server snapshot/trajectory coverage, pitched HUD target selection, the full
`npm run gate`, `npm run net:bench`, a real two-client WebSocket smoke, and
browser cast checks at 1280x720 and 1920x1080.
