# Blender world bridge contract (Asset Phase A2, LOCKED)

Asset Phase A2 supplies the first no-code world-authoring bridge and imports the
current Claurim world into an editable Blender 5.2 LTS scene. It deliberately
exports proposal metadata rather than changing live gameplay authority.

## Committed handoff

- `art/blender/claurim_world.blend` is the editable current-world scene under
  Git LFS. It contains five space collections and the initial 88-record import:
  42 props, 8 doors, 6 containers, 24 spawners, and 8 exterior landmarks.
- `art/world/current-world.json` is a deterministic reference snapshot built
  from current TypeScript content. The gate rejects a stale snapshot.
- Kaldwyn includes the D-005 heightfield sampled at eight-metre intervals with
  authoring seed 20260730. It is labelled and treated as read-only reference
  terrain; interior collections contain their current room volumes.
- `docs/screenshots/asset_phase_a2_world_import.png` shows the Falkmoor pilot
  collections instantiated at their existing content placements on the
  imported terrain reference.

## Claurim Blender panel

The versioned add-on in `tools/blender_addon/claurim_world_bridge/` provides:

1. **Import Current World** rebuilds categorized space collections from the
   committed snapshot without touching unrelated Blender objects.
2. **Asset Palette** exposes every approved manifest GLB as a collection asset
   and places a uniquely named collection instance in a selected space.
3. **Snap Selected** grounds selected placements to the imported reference
   surface.
4. **Validate Selection/World** checks stable/duplicate IDs, spaces, asset
   license/catalog membership, transform rules, positive scale, baseline
   preservation, door anchors, reference-terrain contact, Principled
   materials, LOD nodes, and triangle budgets.
5. **Export Claurim World** writes deterministic placement metadata, runs the
   repository validator, and may open the configured local QA URL.

Objects use stable custom properties including `claurim_type`, `claurim_id`,
`claurim_space_id`, `claurim_kind`, `claurim_asset_id`, `claurim_solid`, and
the category-specific data record. Blender X maps to Claurim X, Blender Y to
Claurim Z, Blender Z to Claurim Y, and Blender Z rotation to Claurim yaw.

## Asset palette and placement rules

- The current palette contains the D-050 Falkmoor tower, wall, and arch. New
  manifest-approved assets appear automatically after a fresh import.
- Existing non-asset-backed props remain clearly visible wireframe proxies so
  artists can understand and adjust the whole layout before their replacement
  art exists.
- New A2 records must be `prop` placements with an approved `asset_id`. The
  bridge rejects new gameplay doors, spawners, containers, or unlicensed
  meshes and prevents deletion of baseline records.
- Door markers remain linked to their declared prop anchors. All original
  world transforms survive a Blender save/reopen/export within 1e-5 metres or
  radians.

## Authority boundary

`art/world/blender-world-export.json` is tagged
`runtimeAuthority: "proposal"`. A2 does not make it an input to simulation,
collision, navigation, rendering, content, protocols, saves, quests, or
schedules. Existing TypeScript data remains authoritative. This prevents a
visual edit from silently moving a collider, door, encounter, or narrative
target.

Authored terrain and live location migration remain separately lockable later
phases. A migration must explicitly compare an A2 proposal with current
content, resolve collisions/anchors/routes, update runtime authority, and pass
the appropriate traversal, narrative, jitter, and performance gates.

## Repeatable build and acceptance

From the repository root with Blender 5.2.x LTS:

```powershell
npm.cmd run export:blender-world
& "F:\SteamLibrary\steamapps\common\Blender\blender.exe" `
  --background --factory-startup `
  --python scripts/blender/build_world_authoring_scene.py -- --repo-root "$PWD"
& "F:\SteamLibrary\steamapps\common\Blender\blender.exe" `
  --background art/blender/claurim_world.blend `
  --python scripts/blender/qa_world_bridge.py -- --repo-root "$PWD"
npm.cmd run gate
```

A2 passes only when the add-on installs and registers in Blender 5.2, all five
spaces and 88 records import, the palette contains every manifest asset,
selection/world validation is clean, the saved scene reopens, its initial
round trip contains no drift or proposal warning, visual evidence is complete,
and the full repository gate passes.
