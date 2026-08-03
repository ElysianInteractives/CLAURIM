"""Install and enable the versioned Claurim bridge in the current Blender profile."""

from __future__ import annotations

import argparse
import shutil
import sys
import importlib
from pathlib import Path

import bpy


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", required=True)
    values = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return parser.parse_args(values)


def main() -> None:
    repo_root = Path(arguments().repo_root)
    source = repo_root / "tools" / "blender_addon" / "claurim_world_bridge"
    addon_root = Path(bpy.utils.user_resource("SCRIPTS", path="addons", create=True))
    destination = addon_root / "claurim_world_bridge"
    if destination.exists():
        shutil.rmtree(destination)
    shutil.copytree(source, destination)
    if str(addon_root) not in sys.path:
        sys.path.insert(0, str(addon_root))
    importlib.invalidate_caches()
    import addon_utils
    addon_utils.modules_refresh()
    bpy.ops.preferences.addon_enable(module="claurim_world_bridge")
    bpy.ops.wm.save_userpref()
    print(f"CLAURIM A2 add-on installed={destination}")


if __name__ == "__main__":
    main()
