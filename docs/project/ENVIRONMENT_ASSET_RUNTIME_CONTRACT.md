# Environment asset runtime contract (Asset Phase A1, LOCKED)

Asset Phase A1 activates the three D-050 Falkmoor pilot GLBs behind a
renderer-owned, failure-safe runtime. It establishes how approved world assets
reach the game without moving any gameplay authority into Blender or Three.js.

## Runtime catalog

- `src/render/environment_assets.ts` contains the browser-safe runtime subset
  of `art/asset-manifest.json`: stable ID, URL, dimensions, root/collider node,
  ordered LOD nodes, and triangle budgets.
- The build-time manifest remains authoritative for source paths, provenance,
  licensing, material/texture budgets, bounds, and Blender conventions. Tests
  reject drift between the manifest and runtime catalog.
- A runtime entry is eligible only after the normal GLB validator and a second
  in-browser node/triangle check both pass.

## Loading and delivery

- GLTFLoader, KTX2Loader, and MeshoptDecoder are imported lazily when the first
  catalog asset is requested. KTX2 transcodes through the vendored Three.js
  Basis runtime in `public/assets/basis/`.
- Concurrent requests for one stable asset ID share one load. Successful
  templates remain cached and instances share immutable geometry/material
  resources.
- `Renderer.reloadEnvironmentAssets()` invalidates the catalog cache and
  rebuilds the current space with revisioned URLs. Vite also reloads changed
  public assets during local authoring.
- Runtime diagnostics report pending, ready, and failed asset counts through
  the existing offline QA/performance handle. `?qaPerf=1` mirrors its latest
  five-second snapshot to `html[data-claurim-qa-perf]` for browser automation.

## Visual replacement and fallback

- `ruin_tower`, `ruin_wall`, and `ruin_arch` props use the Falkmoor tower,
  wall, and arch pilots respectively. Every placement retains its existing
  content ID, position, ground height, yaw, and declared dimensions.
- A procedural prop is built first. It is removed only after its catalog GLB
  loads and validates. Network, file, decoder, node, and budget failures keep
  that procedural visual live and emit one diagnostic for the cached request.
- The exported collider node is mandatory metadata but never enters the render
  instance. `CONTENT.props`, `CollisionIndex`, and the existing space geometry
  remain the sole gameplay collision authority.

## LOD and performance

- Each live instance is a Three.js LOD containing only the authored LOD0 and
  LOD1 visual nodes. LOD1 must contain fewer triangles than LOD0 and each level
  must remain within its manifest ceiling.
- Normal high-detail distance is 55 metres. D-048's sustained frame-pressure
  tier may shorten the band to 28 metres, matching the existing building
  policy. This affects presentation only.
- Cached geometry is marked shared so space transitions do not dispose a
  resource still owned by another instance or the catalog template.

## Explicit non-goals

A1 does not add a Blender placement importer, asset palette, authored terrain,
door/container/spawner export, commissioned library, new content placements,
new collision, or save/protocol changes. Those remain separately lockable A2+
work. A visual mesh or Blender collider must never silently become simulation
authority.

## Acceptance

- Asset and runtime catalogs agree on all three pilots.
- Actual GLBs pass source/build validation and load in the production browser
  build with zero console errors.
- Falkmoor displays cached authored tower/wall/arch visuals at the existing
  placements, including both wall instances.
- Missing or invalid assets retain their procedural visuals.
- Unit/type/content/asset tests, production build, and the complete repository
  gate pass without changing simulation, saves, protocol, or collision.
