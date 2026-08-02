# Visual asset and world-authoring proposal (UNLOCKED)

This is a proposal only. It does not change D-005 terrain authority, content
placement, collision, or the current runtime until the user and Codex lock a
bounded implementation phase.

Asset Phase A0 is now locked and implemented by D-050: Blender 5.2 LTS
conventions, an enforceable manifest/provenance/GLB gate, editable Falkmoor
tower/wall/arch source, repeatable validated exports, and visual evidence
exist. The
runtime catalog, Blender placement bridge, authored terrain, and location
migration remain the later phases proposed below.

## Honest current state

- Claurim renders code-native procedural geometry. D-046 can validate and
  instantiate registered character GLB/glTF assets, but it does not yet load a
  commissioned model catalog or a visually authored whole-world scene.
- Buildings, terrain shape, roads, doors, and deterministic vegetation are
  still authored through repository data/functions. Blender assets can be
  created now, but visual placement/sculpting will not appear in the game
  until the bridge below is implemented.

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

## The Claurim Blender bridge to build

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

## Remaining proposed locked phases

1. **Asset foundation:** manifest/licensing, runtime world/prop GLB registry,
   KTX2 + Meshopt support, fallbacks, budgets, and hot reload.
2. **Blender round trip:** importer, asset palette, custom-property schema,
   validation panel, placement export, and one test clearing.
3. **Authored terrain authority:** shared quantized height/splat data, server
   and client sampling, navigation/collision migration, deterministic tests.
4. **World migration:** Falkmoor first, then Thornmere, Fenharrow, Weeping
   Stones, roads/forest, and interiors; each location passes traversal,
   narrative, jitter, and performance gates before the next replaces code-
   native fallback geometry.

The user can begin learning Blender and creating individual, correctly scaled
GLBs now. Whole-world visual editing should wait for phases 1-2 so placement
work can round-trip instead of being manually transcribed into code.
