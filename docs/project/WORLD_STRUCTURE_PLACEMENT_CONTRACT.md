# World structure placement contract

QA Phase E locks terrain pads, grounded structure presentation, and anchored
entrances while retaining the shared heightfield and traversal contracts.

## Terrain operation order

- Rolling terrain, rim, river, and road are evaluated before authored site
  pads. Settlement, ruin, and mine pads are the final large-scale operations;
  fine detail is masked out wherever a pad or road is active.
- The Fenharrow core resolves to exactly `14 m` across every current building,
  well, and forge footprint for every seed. The road may feather into the
  settlement edge but cannot re-carve its structure pads.
- Renderer placement, actor movement, navigation, projectiles, camera
  obstruction, and authoring validation continue to sample the same pure
  `terrainHeight(x, z, seed)` function.

## Grounded presentation

- Exterior structures take their group origin from the shared terrain sample.
- Building foundations extend below the pad as well as above it, preventing a
  daylight seam at terrain triangle boundaries without changing collision.
- The Fenharrow well includes an explicit top ring and dark shaft surface; its
  side wall also extends below grade so normal camera angles cannot make it
  appear incomplete or buried.

## Door anchors

- A door may carry a required prop-relative anchor: parent prop id, local X/Z,
  and yaw offset. Content authoring resolves that anchor once to world X/Z/yaw
  for existing simulation, AI, interaction, and traversal consumers.
- Validation rejects missing parents, cross-space anchors, or any drift between
  the recorded anchor and resolved transform.
- Exterior mine, Siltroot, and Fenharrow entrances are anchored to their
  authored frames/shells. The renderer applies resolved door yaw.
- Door destinations and interaction rules remain unchanged.

## Development QA starts

Named `?qa=` start points are accepted only by the Vite development build and
only offline. They never apply to production builds or online clients. They
are repeatable presentation entry points, not gameplay fast travel and not
save data.

## Acceptance

Acceptance requires flat multi-seed footprint tests, anchor/rotation tests,
complete well geometry, `npm run world:tour`, the full `npm run gate`, and
direct 1280x720 plus 1920x1080 Fenharrow/entrance evidence with exact viewport
dimensions and no browser warnings/errors.
