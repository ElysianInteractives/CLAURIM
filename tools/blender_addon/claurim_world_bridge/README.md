# Claurim World Bridge

This Blender 5.2 LTS add-on supplies the **Claurim** sidebar in the 3D View.
It imports the committed current-world snapshot, exposes approved GLBs as
collection assets, validates IDs/transforms/anchors/materials/budgets/terrain
contact, and exports proposal-only placement metadata.

The generated `art/blender/claurim_world.blend` already contains the initial
import. On the configured development machine the add-on is installed by:

```powershell
& "F:\SteamLibrary\steamapps\common\Blender\blender.exe" `
  --background --factory-startup `
  --python scripts/blender/install_claurim_bridge.py -- --repo-root "$PWD"
```

Open the world scene, choose **Claurim** in the 3D View sidebar, select a space
and approved asset, and use **Place Palette Asset**. Move/rotate/scale the
instance normally, give it a unique stable ID, then use **Snap Selected** and
**Validate World**. **Export Claurim World** writes
`art/world/blender-world-export.json` and runs the repository validator.

During A2 the export is intentionally tagged `runtimeAuthority: proposal`.
It does not alter TypeScript collision, terrain, doors, navigation, content,
saves, or protocols until a later location/terrain migration is separately
locked and passed.
