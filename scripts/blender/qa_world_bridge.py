"""Reopen and validate the committed A2 Blender scene headlessly."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import bpy


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", required=True)
    values = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return parser.parse_args(values)


def main() -> None:
    repo_root = Path(arguments().repo_root)
    sys.path.insert(0, str(repo_root / "tools" / "blender_addon"))
    import claurim_world_bridge

    if not hasattr(bpy.types, "CLAURIM_PT_world_bridge"):
        claurim_world_bridge.register()
    errors, warnings = claurim_world_bridge.validate_world(bpy.context.scene)
    if errors:
        raise RuntimeError("A2 reopened scene validation failed:\n" + "\n".join(errors))
    expected = json.loads((repo_root / "art" / "world" / "blender-world-export.json").read_text(encoding="utf-8"))
    actual = claurim_world_bridge.current_export(bpy.context.scene)
    if actual != expected:
        raise RuntimeError("A2 reopened scene export does not match the committed round trip")
    bpy.ops.object.select_all(action="DESELECT")
    anchored_door = next(
        obj for obj in claurim_world_bridge.placement_objects()
        if obj.get("claurim_type") == "door"
        and json.loads(str(obj.get("claurim_data_json", "{}"))).get("anchor_prop_id")
    )
    anchored_door.select_set(True)
    selected_errors, _selected_warnings = claurim_world_bridge.validate_world(
        bpy.context.scene, selected_only=True,
    )
    if selected_errors:
        raise RuntimeError("A2 selected-door validation failed:\n" + "\n".join(selected_errors))
    counts: dict[str, int] = {}
    for obj in claurim_world_bridge.placement_objects():
        record_type = str(obj.get("claurim_type"))
        counts[record_type] = counts.get(record_type, 0) + 1
    print(f"CLAURIM A2 reopened OK counts={json.dumps(counts, sort_keys=True)} warnings={len(warnings)}")


if __name__ == "__main__":
    main()
