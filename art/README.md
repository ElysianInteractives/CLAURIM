# Claurim art source

Git is the source of truth for accepted art. Blender working files live under
`art/blender/` and use Git LFS; game-ready GLB exports live under
`public/assets/models/` so the GitHub Pages build receives ordinary files
without requiring LFS at deploy time.

Phase A0 is locked to Blender 5.2.0 LTS, one Blender metre per Claurim metre,
ground-centred origins, applied rotation/scale, stable snake-case asset IDs,
Principled BSDF materials, and explicit LOD/collider metadata. The enforceable
rules and pilot budgets are in `docs/project/BLENDER_ASSET_AUTHORING_CONTRACT.md`.

Regenerate the Falkmoor pilot kit from the repository root:

```powershell
& "F:\SteamLibrary\steamapps\common\Blender\blender.exe" `
  --background --factory-startup `
  --python scripts/blender/build_falkmoor_pilot.py -- --repo-root "$PWD"
npm.cmd run validate:assets
```

The executable path is machine-specific. Use any Blender 5.2.x LTS executable;
do not commit a local installation path.

Asset Phase A2 also commits `art/blender/claurim_world.blend`, the imported
editable five-space world. Regenerate and validate it with:

```powershell
npm.cmd run export:blender-world
& "F:\SteamLibrary\steamapps\common\Blender\blender.exe" `
  --background --factory-startup `
  --python scripts/blender/build_world_authoring_scene.py -- --repo-root "$PWD"
& "F:\SteamLibrary\steamapps\common\Blender\blender.exe" `
  --background art/blender/claurim_world.blend `
  --python scripts/blender/qa_world_bridge.py -- --repo-root "$PWD"
```

The Blender **Claurim** sidebar is versioned under
`tools/blender_addon/claurim_world_bridge/`. Its initial placement export is a
proposal and is not consumed by runtime gameplay until a later migration lock.
