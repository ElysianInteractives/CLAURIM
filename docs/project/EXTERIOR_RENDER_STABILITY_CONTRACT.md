# Exterior render stability contract

QA Phase M locks the browser-host repair for the exterior jitter regression
reported after the D-043 world-density expansion. This contract changes only
presentation ownership and performance; simulation, collision, navigation,
combat, networking, saves, and authored world density remain authoritative and
unchanged.

User retesting after D-046 exposed a separate whole-camera discontinuity and
online read-count smoothing defect. D-047 supersedes the complete jitter exit
while retaining every D-045 density/draw/history requirement; see
`FRAME_PRESENTATION_STABILITY_CONTRACT.md`.

## Terrain decoration

- Every streamed exterior cell retains `TREE_TRIES_PER_CELL >= 90` and the
  same coordinate-hash placement, scale, silhouette, and material choices.
- Repeated trunks, two tree-top shapes, two crown shapes, and rocks use
  deterministic `InstancedMesh` batches. Geometry and water resources are
  shared across cells; cell-owned terrain geometry is disposed on eviction.
- At the 25-cell Falkmoor, Thornmere, Fenharrow, and Weeping Stones QA
  checkpoints, terrain must remain at or below 300 mesh draw nodes and 40
  unique geometries while retaining more than 100 decoration instances.
- A future asset/LOD pipeline may replace these shapes, but it must preserve
  the same or a stricter measured draw budget. Raw unbounded high-poly meshes
  are not part of this lock.

## Frame presentation

- The fixed-step host captures actor transforms after every successful
  `IWorld.step`, not only once per animation frame.
- Rendering interpolates only the last two observed simulation states. When a
  slow frame contains several 30 Hz ticks, intermediate observations advance
  history so the renderer never blends across the whole multi-tick gap.
- First observation, space transition, and movement beyond the existing 4 m
  snap boundary still snap. Render-time observation remains as the fallback
  for asynchronous remote snapshots.
- The displayed local-player transform remains the single source for the body,
  third-person camera, streamed-terrain center, and caster telegraphs.

## Acceptance

- `tests/presentation.test.ts` covers one, zero, and multiple observed ticks
  between samples, including the final tick-pair requirement.
- `tests/world_content_expansion.test.ts` covers named exterior draw-node,
  unique-geometry, and retained-decoration budgets.
- `npm run gate` passes, and direct browser inspection covers Fenharrow,
  Thornmere, and Weeping Stones with clean warning/error logs.
