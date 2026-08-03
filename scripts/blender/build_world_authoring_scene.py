"""Build the first editable Claurim world-authoring scene for Asset Phase A2."""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", required=True)
    values = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return parser.parse_args(values)


def configure_preview(repo_root: Path) -> None:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    world = bpy.data.worlds.get("World") or bpy.data.worlds.new("World")
    scene.world = world
    world.color = (0.025, 0.04, 0.055)

    bpy.ops.object.light_add(type="SUN", location=(80, -470, 120))
    sun = bpy.context.object
    sun.name = "CLAURIM_A2_preview_sun"
    sun.data.energy = 2.2
    sun.rotation_euler = (math.radians(30), math.radians(-18), math.radians(-32))

    bpy.ops.object.light_add(type="AREA", location=(18, -446, 78))
    area = bpy.context.object
    area.name = "CLAURIM_A2_preview_fill"
    area.data.energy = 1500
    area.data.shape = "DISK"
    area.data.size = 26
    area.rotation_euler = (Vector((40, -418, 24)) - area.location).to_track_quat("-Z", "Y").to_euler()

    # Keep the evidence camera inside the authored ruin plateau; the southern
    # region rim rises far above this clearing outside its 46 m site radius.
    bpy.ops.object.camera_add(location=(66, -446, 78))
    camera = bpy.context.object
    camera.name = "CLAURIM_A2_world_camera"
    camera.data.lens = 52
    camera.rotation_euler = (Vector((40, -416, 26)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera
    scene.render.filepath = str(repo_root / "docs" / "screenshots" / "asset_phase_a2_world_import.png")
    scene.view_settings.look = "AgX - Medium High Contrast"


def main() -> None:
    args = arguments()
    repo_root = Path(args.repo_root)
    sys.path.insert(0, str(repo_root / "tools" / "blender_addon"))
    import claurim_world_bridge

    bpy.ops.wm.read_factory_settings(use_empty=True)
    claurim_world_bridge.register()
    counts = claurim_world_bridge.build_world_scene(repo_root)
    errors, warnings = claurim_world_bridge.validate_world(bpy.context.scene)
    if errors:
        raise RuntimeError("A2 world validation failed:\n" + "\n".join(errors))
    claurim_world_bridge.write_world_export(bpy.context.scene, run_repository_validator=False)
    configure_preview(repo_root)
    # Leave the committed scene portable. The add-on derives the repository
    # from the .blend location unless an artist explicitly overrides it.
    bpy.context.scene.claurim_repo_root = ""
    source = repo_root / "art" / "blender" / "claurim_world.blend"
    source.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(source), compress=True)
    bpy.ops.render.render(write_still=True)
    print(f"CLAURIM A2 spaces={counts['spaces']} placements={counts['placements']} assets={counts['assets']}")
    print(f"CLAURIM A2 validation={len(errors)} errors, {len(warnings)} warnings")
    print(f"CLAURIM A2 source={source}")
    print(f"CLAURIM A2 preview={bpy.context.scene.render.filepath}")


if __name__ == "__main__":
    main()
