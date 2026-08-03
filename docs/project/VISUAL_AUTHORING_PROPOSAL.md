# Visual asset and world-authoring proposal (UNLOCKED)

The unimplemented phases in this document are proposals only. They do not
change D-005 terrain authority, content placement, or collision until the user
and Codex lock a bounded implementation phase.

Asset Phase A0 is locked and implemented by D-050: Blender 5.2 LTS
conventions, an enforceable manifest/provenance/GLB gate, editable Falkmoor
tower/wall/arch source, repeatable validated exports, and visual evidence
exist. Asset Phase A1 is locked and implemented by D-052: a cached,
Meshopt/KTX2-ready runtime catalog activates those pilots with LOD, hot reload,
and procedural fallbacks while content retains placement/collision authority.
Asset Phase A2 is locked and implemented by D-053: a no-code Blender sidebar,
manifest palette, current-world import, validators, deterministic proposal
export, and committed editable scene now exist. Authored terrain and live
location migration remain the later proposed phases below.

## Honest current state

- Most of Claurim still renders code-native procedural geometry. D-052 loads
  the three Falkmoor environment pilots, while D-046 can validate registered
  character GLB/glTF assets; there is not yet a commissioned model catalog or
  a visually authored whole-world scene.
- Buildings, terrain shape, roads, doors, and deterministic vegetation still
  take live authority from repository data/functions. Blender placement
  proposals can now be authored visually, but they will not appear in the game
  until a later migration explicitly adopts and tests them.

## Recommended free authoring stack

- **Blender LTS** is the scene editor, modeler, terrain sculptor, material
  author, animation editor, and asset browser. Use one current LTS version for
  the whole project and record it in the source file.
- **Krita or GIMP** can edit texture masks and decals. Blender itself can bake
  normal, ambient-occlusion, and PBR maps.
- **glTF Binary (`.glb`)** is the runtime format. It carries meshes, metal/
  rough PBR materials, textures, skins, animations, and custom properties.
- Prefer original work and clearly redistributable assets. Poly Haven is a
  useful CC0 source; every imported asset still receives a source URL, author,
  license, and modification record in Claurim's asset manifest.

Blender necessarily edits a local working file. Git remains the source of
truth: commit source `.blend` files through a Git-LFS art repository and commit
optimized runtime GLBs/textures to Claurim. Local exports are build products,
not the only copy of the work.

## Authoring conventions

- One Blender metre equals one Claurim metre. Apply rotation/scale before
  export, place an object's origin at its ground/contact point, and let the
  glTF exporter convert Blender Z-up to glTF Y-up.
- Use Principled BSDF metal/rough materials. Bake complex procedural materials
  to texture maps before export.
- Asset names are stable IDs, not prose labels: for example
  `tree_pine_a`, `building_thornmere_house_a`, and `prop_stone_well_a`.
- Author `LOD0`, `LOD1`, and optional `LOD2` collections. Triangle, material,
  texture, and draw budgets are validated before an export can replace a live
  fallback.
- Character files preserve the D-041/D-046 named rig/equipment sockets.
- Gameplay metadata uses Blender empties/custom properties: `claurim_id`,
  `asset_id`, `collider`, `door_id`, `container_id`, `spawner_id`, and
  `landmark_id`. Visual meshes never silently become gameplay collision.

## The implemented Claurim Blender bridge

The add-on provides one **Claurim** panel rather than requiring code edits:

1. **Import Current World** builds editable collections for terrain, roads,
   props, doors, containers, spawners, and landmarks from repository data.
2. **Asset Palette** exposes approved tree, rock, building, prop, and wildlife
   collections for drag/drop or collection-instance placement.
3. **Validate Selection/World** reports duplicate IDs, missing sockets,
   unlicensed assets, unapplied transforms, invalid door anchors, unsupported
   materials, excessive triangles/textures, and collider/terrain conflicts.
4. **Export Claurim World** writes optimized visual GLBs plus deterministic
   placement/collider/door metadata. One command runs the repository validator
   and opens the local QA checkpoint.

## Terrain, vegetation, and buildings

- **Terrain:** Blender imports the current Kaldwyn surface. Sculpting exports a
  quantized height field plus material/biome splat maps. The server, client,
  renderer, navigation, camera, and projectiles must all sample that same data;
  this deliberately reopens D-005 and therefore needs its own lock/migration.
- **Trees/rocks:** artists paint or distribute collection instances with
  Geometry Nodes. The exporter records asset ID + transform; the runtime keeps
  one shared geometry/material and submits placements as `InstancedMesh`
  batches rather than baking thousands of unique meshes.
- **Buildings:** linked collection instances supply visuals. Named empties
  author simple gameplay colliders and door anchors. The exporter preserves
  content IDs so quests, schedules, maps, saves, and networking do not depend
  on Blender object order.

## Implemented and remaining locked phases

1. **Asset foundation (A1, implemented by D-052):** manifest/licensing,
   runtime world/prop GLB registry, KTX2 + Meshopt support, fallbacks, budgets,
   and hot reload.
2. **Blender round trip (A2, implemented by D-053):** importer, asset palette,
   custom-property schema, validation panel, placement export, and one test
   clearing.
3. **Authored terrain authority:** shared quantized height/splat data, server
   and client sampling, navigation/collision migration, deterministic tests.
4. **World migration:** Falkmoor first, then Thornmere, Fenharrow, Weeping
   Stones, roads/forest, and interiors; each location passes traversal,
   narrative, jitter, and performance gates before the next replaces code-
   native fallback geometry.

The user can now open `art/blender/claurim_world.blend`, use the Claurim panel,
and author placement proposals without transcribing code. Those proposals
remain non-live until a later migration phase adopts and tests them.
