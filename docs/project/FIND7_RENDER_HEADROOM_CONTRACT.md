# Find7 render-headroom contract

QA Phase P locks the remaining jitter response from `Find7.mp4`. The recording
is a 22.21-second, 836x698, constant-30-fps capture containing 663 decoded
frames. During straight movement it repeatedly presents two changed frames
followed by a nearly unchanged frame; 172 of 662 frame transitions are near-
identical. That signature is missed presentation, not an authoritative actor
being pushed back by a collider.

The same Thornmere route holds 60 fps in the instrumented browser. The shared
camera obstruction query costs about 0.05 ms at the nearest recorded building,
so changing collider dimensions or movement authority would not address the
captured cadence. D-048 instead restores graphics headroom lost in D-046 and
adds a geometry fallback after D-047's raster fallback is exhausted.

The later Find8 replay confirmed that this headroom work did not clear the
stationary-gait symptom. D-049 addresses the independent stale final-tick
presentation cause in `STATIONARY_PRESENTATION_SETTLEMENT_CONTRACT.md`; D-048's
bounded model budgets and load protection remain valid.

## Close structure headroom

- A high-detail building retains rounded walls, foundation, pitched roof
  panels, window depth, trim, and chimney silhouettes.
- Narrow trim no longer spends rounded-box subdivisions on bevels that are
  smaller than a gameplay pixel. Its pieces are merged into one rigid mesh;
  broad surfaces retain rounded geometry.
- One close building is bounded to 2,000-3,000 triangles. The five authored
  Thornmere shells total 10,000-12,000 close-tier triangles. Before D-048 each
  shell cost 12,732 triangles, or 63,660 for the five-building Find7 area.
- The 55 m normal high/medium transition and 15 percent hysteresis remain the
  default. Colliders, doors, authored transforms, and terrain sampling are
  independent of the visual shell.

## Sustained-load fallback

- D-047 raster-density reduction remains first response to sustained load.
- Geometry changes only if the raster ratio is already at its floor and
  averaged timing remains slower than 45 fps for one further second.
- Under pressure, the local player remains high detail. Surrounding actors use
  their socket-compatible medium rigs, building close detail is retained
  within 28 m, and only the center streamed terrain cell keeps high decoration
  geometry. Actor existence, simulation, collision, equipment, posing, and
  every vegetation placement remain unchanged.
- High geometry returns only after six sustained seconds above 57 fps. The
  asymmetric thresholds prevent visual-tier oscillation.

## Per-frame CPU work

- Character rig-node lookups are cached after first pose rather than recursively
  searching each articulated hierarchy every frame.
- Flash-capable materials are cached per character and touched only when the
  hit-flash state changes, not traversed on every rendered frame.
- `?qaPerf=1` emits one five-second render snapshot containing FPS, missed-frame
  percentage, worst interval, draw calls, triangles, geometry count, visible
  mesh count, pixel ratio, and geometry tier. Development uses
  `?qa=thornmere&qaPerf=1&qaWalk=1` for a repeatable moving route.

## Authority boundary

No collider, movement rule, navigation rule, camera-contact result, combat
state, protocol field, save field, authored placement, or simulation tick is
changed. All adaptive state remains renderer-only and is never serialized or
replicated.

## Acceptance

- Focused tests pin individual and aggregate Thornmere building budgets, a
  matrix-correct populated checkpoint budget, medium-rig socket compatibility,
  terrain-cell fallback, raster-first geometry reduction, and slow recovery.
- The instrumented Thornmere scene must remain at 60 fps on the QA browser with
  zero steady-state missed frames, retain the high tier at normal load, and
  reduce its directly visible triangle submission from the pre-fix baseline.
- `npm run gate`, `npm run world:tour`, `npm run ai:bench`, `npm run net:bench`,
  and `npm run qa:ws` pass. Final acceptance remains a new recording on the
  reporting device/browser because screen capture and browser resource limits
  are outside deterministic automation.
