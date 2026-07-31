# Audio and presentation contract

Plan 9 hardens the browser host without changing simulation authority,
network protocol, combat resolution, or save data. D-031 locks the following
host-only behavior.

## Transform presentation

- The simulation remains fixed at 30 Hz. `main.ts` passes the remaining
  accumulator fraction to the renderer; the renderer may delay display by at
  most one observed transform.
- Each actor keeps a previous/current presentation pair. Position uses linear
  interpolation and yaw takes the shortest wrapped arc.
- The first observation, a space transition, or a movement jump greater than
  4 m snaps to the authoritative transform. Interpolation never crosses a
  door transition or smooths a teleport through world geometry.
- The local camera, streamed-terrain center, character mesh, and
  caster-anchored telegraph use the same displayed player/actor transform.
  Ground-targeted danger areas stay at their authoritative target position.
- Presentation history is discarded when a space is rebuilt and when an actor
  leaves the observed set. It never writes through `IWorld` or changes a
  snapshot, input, collision query, or outcome.

## Browser audio director

- Web Audio is created only after keyboard or pointer activation. A locked or
  suspended browser audio context must not stop the game.
- The browser-owned graph is `effects`, `ambience`, and `music` into `master`.
  Master mute and each bus use bounded 0..1 gain values with short ramps.
- Combat effects are derived only from already-filtered authoritative
  `SimEvent` outcomes. Their mapping and rate limits remain the D-024 cue
  contract.
- The current read-only space kind and game hour select one deterministic
  procedural tonal soundscape: interior, exterior day, or exterior night.
  These beds are a functional mixer exemplar, not the final score, ambience
  asset library, loudness pass, or spatial-source system.
- The Escape settings panel exposes accessible Master, Effects, Ambience, and
  Music sliders plus Mute. Values persist in browser-local host settings under
  `claurim_audio_v1`; malformed or out-of-range values fall back or clamp.
- Audio preferences are not character/world save fields and never enter the
  sim, protocol, server storage, or deterministic replay.

## Browser input and content dispatch

- Escape remains a global close command while an audio input has focus. Other
  gameplay commands remain suppressed for focused inputs.
- Browser attack dispatch resolves the equipped authored weapon type from the
  content catalog. Every equipped `weaponType: 'bow'` submits ranged intent;
  the host must not special-case one bow item id.

## Acceptance

- `tests/presentation.test.ts` pins interpolation, snap boundaries, shortest
  yaw, settings parsing/bounds, bus gains, soundscape choice, accessible
  settings markup, focused Escape capture, and catalog-driven bow dispatch.
- The full `npm run gate` remains mandatory.
- Browser QA opens, edits, and reloads the audio panel at 1280x720 and
  1920x1080; checks focus recovery, clipping/overflow, persistence, and
  warning/error logs. Audible balance and final asset quality require human
  review when an asset pipeline is locked.
