# High-fidelity rendering contract

QA Phase N locks a game-ready higher-fidelity presentation tier without
changing simulation authority, collision, combat, content placement, network
protocols, or saves. "High fidelity" means smoother silhouettes and richer
close-range detail inside explicit browser performance budgets; it does not
mean unbounded film-resolution meshes.

## Character and creature detail

- The local player always uses the high-detail articulated rig. Other actors
  enter high detail within 20 m and leave it beyond 26 m, preventing repeated
  swaps at the boundary. The medium tier retains the same named rig and
  equipment sockets, so pose and loadout code remain shared.
- Code-native high-detail humanoids use smooth torso, limb, face, hand, hair,
  armor, and equipment silhouettes. Wildlife uses smooth body volumes,
  articulated legs, paws, head, tail, antler, and tusk forms. The procedural
  factories remain the live fallback and are bounded to 20,000 triangles per
  humanoid and 15,000 per wildlife model.
- Non-local actors enter the presentation set within 100 m and leave beyond
  120 m. This is render culling only: actors continue to exist and simulate,
  and the local player is never culled.

## Structures and vegetation

- Building shells use a high-detail close tier with rounded masonry, pitched
  roof panels, trim, window panes, and chimney detail. At 55 m they transition
  to a 36-triangle silhouette shell through a Three.js LOD with 15 percent
  hysteresis. D-048 removes invisible narrow-trim bevel density and bounds a
  close shell to 2,000-3,000 triangles without removing those visible forms.
  Authored doors and conservative gameplay colliders are unchanged.
- Every deterministic D-043 vegetation placement remains present. The near
  3x3 cells use smoother shared trunk, canopy, crown, and rock geometry; the
  outer 16 streamed cells use medium geometry. Both tiers remain instanced and
  retain authored color, transform, and density.

## External asset seam

- The optional GLB/glTF registry loads lazily, enables Meshopt decoding,
  validates required rig/socket nodes and triangle budgets, and clones actors
  safely before use. An accepted asset can replace a code-native archetype
  without changing pose, equipment, or renderer APIs.
- This phase ships no commissioned external model library. Missing,
  unregistered, or rejected assets use the live higher-fidelity code-native
  models. Production textures, authored skeletal animation clips, and the
  final art library remain content work rather than renderer architecture.

## Performance and authority boundaries

- A populated Fenharrow, Thornmere, or Weeping Stones exterior checkpoint may
  expose no more than 325 visible mesh nodes and 175,000 visible triangles.
- D-045's 25-cell terrain limits remain no more than 300 mesh nodes and 40
  unique geometries. One high-detail building must remain within 2,000-3,000
  triangles; all five Thornmere shells together remain within 10,000-12,000.
- Normal-load high fidelity remains the default. D-048 may use existing medium
  actor/building/vegetation tiers only after raster density reaches its floor
  and sustained timing remains below 45 fps. The local player stays high.
- Geometry LOD, material choice, asset loading, and actor render culling are
  presentation-only. Simple content colliders remain authoritative; visual
  triangle shape never enters navigation, projectiles, combat, saves, or the
  network protocol.

## Acceptance

Acceptance requires focused fidelity/socket/LOD/asset-seam tests, populated
exterior budget tests, the D-045 stability suite, `npm run ai:bench`,
`npm run world:tour`, the full `npm run gate`, and direct third-person,
first-person, settlement, vegetation, and wildlife browser checks with clean
warning/error logs. Any asset-density change also reruns D-047
`QA-FRAME-STABILITY`.
