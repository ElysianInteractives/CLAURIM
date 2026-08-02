# Frame-presentation stability contract

QA Phase O locks the whole-scene jitter repair that remained after D-045 and
D-046. D-045 removed dense exterior draw submission and missed fixed-step
history as causes; D-047 addresses discontinuous third-person camera recovery,
call-count-dependent remote smoothing, moving projectile presentation, and
sustained raster overload. No simulation outcome, authored collider, combat
rule, save, protocol, or world placement changes.

## Camera collision

- The shared obstruction query still marches conservatively at 5 cm to find
  terrain/interior contact, then refines the first blocked bracket with nine
  binary steps. It does not discover or remove collisions; it returns a more
  precise entry fraction for the same blocked segment.
- A newly closer obstruction compresses the camera immediately. A clearing
  result must remain stable for 0.06 seconds, then the boom releases no faster
  than 5 metres per second with exponential settling. Repeated blocked/clear
  signals at one collider edge therefore keep the safe compressed position
  instead of moving the whole rendered world back and forth.
- First person and space transitions reset camera recovery. The D-034 reticle
  direction and D-036 shoulder composition remain exact and unsmoothed.

## Moving presentation

- Offline actors retain D-045 adjacent-fixed-tick interpolation. Projectiles
  now use a separate transform history with the same observation rule.
- Online non-local actors interpolate from timestamped snapshot tracks over
  the measured 50-250 ms snapshot interval. `actorsInSpace()` does not mutate
  those tracks, so HUD, target, and renderer read count cannot change motion.
- A render-facing `presentationInterpolated` marker prevents online snapshot
  interpolation from being passed through the fixed-tick interpolator again.
  Large corrections retain the existing 3 m snap boundary.
- D-049 closes fixed-tick motion on an unchanged arrival/collision tick instead
  of discarding that tick and replaying the final moving pair. Render sampling
  does not mutate an already-current pair. Exact settlement rules are in
  `STATIONARY_PRESENTATION_SETTLEMENT_CONTRACT.md`.

## Sustained render load

- Native device pixel ratio remains the quality ceiling, capped at 2. After
  0.75 seconds of sustained sub-50-fps timing, raster density steps down by
  0.25 to a floor of 0.75. Geometry, materials, LOD distances, simulation, and
  UI CSS resolution remain unchanged.
- Quality recovers by 0.25 only after four seconds of sustained faster-than-
  58-fps timing. Background-sized gaps are ignored.
- D-048 extends this raster-first response only when a device remains below
  45 fps at the pixel-ratio floor. Its bounded surrounding-geometry fallback
  and Find7 budgets are defined in `FIND7_RENDER_HEADROOM_CONTRACT.md`.

## Acceptance

- The exact Fenharrow collider-edge reproduction must reduce a greater-than-
  5 m raw camera jump to less than 0.1 m per 60 Hz frame. The locked result is
  5.86 m raw versus 0.073 m stabilized.
- Focused tests cover camera release/re-entry/flicker, terrain contact
  refinement, timestamped read-independent remote motion, adaptive raster
  response, fixed-tick interpolation, and projectile history.
- `npm run net:bench`, `npm run qa:ws`, `npm run world:tour`, `npm run
  ai:bench`, and `npm run gate` pass. Direct browser checks cover exterior
  collider release, moving residents/buildings, tight interiors, first person,
  and clean non-debug logs.
