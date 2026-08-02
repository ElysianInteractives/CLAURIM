"""Build the editable Phase A0 Falkmoor pilot and deterministic GLB exports.

Run with Blender 5.2.x LTS. This script creates original clean-room geometry;
it does not download or incorporate third-party meshes, textures, or materials.
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ASSET_IDS = (
    "falkmoor_ruin_tower_a",
    "falkmoor_ruin_wall_a",
    "falkmoor_ruin_arch_a",
)


def args_after_separator() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", required=True)
    arguments = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(arguments)


def clean_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.unit_settings.length_unit = "METERS"
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.image_settings.file_format = "PNG"
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.world = bpy.data.worlds.new("Claurim_Preview_World")
    scene.world.color = (0.025, 0.035, 0.055)


def material(name: str, color: tuple[float, float, float, float], roughness: float) -> bpy.types.Material:
    result = bpy.data.materials.new(name)
    shader = result.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = color
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = 0.0
    return result


def move_to_collection(obj: bpy.types.Object, collection: bpy.types.Collection) -> None:
    for owner in tuple(obj.users_collection):
        owner.objects.unlink(obj)
    collection.objects.link(obj)


def make_empty(
    name: str,
    collection: bpy.types.Collection,
    parent: bpy.types.Object | None = None,
) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, None)
    collection.objects.link(obj)
    obj.parent = parent
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.4
    return obj


def activate(obj: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def finalize_mesh(
    obj: bpy.types.Object,
    collection: bpy.types.Collection,
    parent: bpy.types.Object,
    mat: bpy.types.Material,
    bevel: float = 0.0,
) -> bpy.types.Object:
    move_to_collection(obj, collection)
    activate(obj)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if bevel > 0:
        modifier = obj.modifiers.new("game_ready_edge_softening", "BEVEL")
        modifier.width = bevel
        modifier.segments = 1
        modifier.limit_method = "ANGLE"
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.data.materials.append(mat)
    obj.parent = parent
    obj["asset_id"] = parent.parent.get("asset_id", "") if parent.parent else ""
    obj["role"] = "visual"
    obj["transforms_applied"] = True
    return obj


def cube(
    name: str,
    dimensions: tuple[float, float, float],
    location: tuple[float, float, float],
    collection: bpy.types.Collection,
    parent: bpy.types.Object,
    mat: bpy.types.Material,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    bevel: float = 0.0,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    return finalize_mesh(obj, collection, parent, mat, bevel)


def cylinder(
    name: str,
    vertices: int,
    radius: float,
    depth: float,
    location: tuple[float, float, float],
    collection: bpy.types.Collection,
    parent: bpy.types.Object,
    mat: bpy.types.Material,
    bevel: float = 0.0,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    obj = bpy.context.object
    obj.name = name
    return finalize_mesh(obj, collection, parent, mat, bevel)


def torus(
    name: str,
    major_radius: float,
    minor_radius: float,
    major_segments: int,
    minor_segments: int,
    z: float,
    collection: bpy.types.Collection,
    parent: bpy.types.Object,
    mat: bpy.types.Material,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=major_segments,
        minor_segments=minor_segments,
        location=(0.0, 0.0, z),
    )
    obj = bpy.context.object
    obj.name = name
    return finalize_mesh(obj, collection, parent, mat)


def asset_roots(asset_id: str) -> tuple[bpy.types.Collection, bpy.types.Object, bpy.types.Object, bpy.types.Object]:
    collection = bpy.data.collections.new(asset_id)
    bpy.context.scene.collection.children.link(collection)
    root = make_empty(asset_id, collection)
    root["asset_id"] = asset_id
    root["asset_type"] = "structure"
    root["author"] = "Elysian Interactives"
    root["license"] = "Claurim-Original"
    root["origin"] = "ground-center"
    root["unit_meters"] = 1.0
    root["source_up_axis"] = "Z"
    root["runtime_up_axis"] = "Y"
    root["blender_version"] = "5.2.0 LTS"
    root["transforms_applied"] = True
    lod0 = make_empty(f"{asset_id}__LOD0", collection, root)
    lod0["lod"] = "LOD0"
    lod1 = make_empty(f"{asset_id}__LOD1", collection, root)
    lod1["lod"] = "LOD1"
    return collection, root, lod0, lod1


def collider(
    asset_id: str,
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    shape: str,
    solid: bool,
    size: tuple[float, float, float],
) -> bpy.types.Object:
    result = make_empty(f"{asset_id}__COLLIDER", collection, root)
    result.empty_display_type = "CUBE" if shape == "box" else "CIRCLE"
    result["role"] = "collider"
    result["shape"] = shape
    result["solid"] = solid
    result["size_x"] = size[0]
    result["size_y"] = size[1]
    result["size_z"] = size[2]
    return result


def build_tower(stone: bpy.types.Material, moss: bpy.types.Material) -> bpy.types.Object:
    asset_id = ASSET_IDS[0]
    collection, root, lod0, lod1 = asset_roots(asset_id)
    root["dimensions_meters"] = [8.0, 10.0, 8.0]
    cylinder("tower_lod0_body", 32, 3.9, 8.6, (0, 0, 4.3), collection, lod0, stone, 0.08)
    for index, z in enumerate((1.1, 3.25, 5.4, 7.55)):
        torus(f"tower_lod0_course_{index}", 3.76, 0.12, 32, 6, z, collection, lod0, moss if index == 3 else stone)
    for index in range(12):
        angle = (math.tau * index) / 12
        cube(
            f"tower_lod0_crenel_{index:02d}",
            (0.78, 0.58, 1.4),
            (3.62 * math.cos(angle), 3.62 * math.sin(angle), 9.3),
            collection,
            lod0,
            stone,
            rotation=(0, 0, angle),
            bevel=0.06,
        )
    cube("tower_lod0_door_recess", (1.75, 0.08, 2.8), (0, -3.91, 1.4), collection, lod0, moss, bevel=0.025)

    cylinder("tower_lod1_body", 12, 3.9, 9.2, (0, 0, 4.6), collection, lod1, stone)
    for index in range(6):
        angle = (math.tau * index) / 6
        cube(
            f"tower_lod1_crenel_{index:02d}",
            (0.9, 0.65, 0.8),
            (3.5 * math.cos(angle), 3.5 * math.sin(angle), 9.6),
            collection,
            lod1,
            stone,
            rotation=(0, 0, angle),
        )
    collider(asset_id, collection, root, "box", True, (7.2, 9.5, 7.2))
    return root


def build_wall(stone: bpy.types.Material, moss: bpy.types.Material) -> bpy.types.Object:
    asset_id = ASSET_IDS[1]
    collection, root, lod0, lod1 = asset_roots(asset_id)
    root["dimensions_meters"] = [10.0, 3.0, 1.5]
    columns = 8
    rows = 4
    gap_x = 0.08
    gap_z = 0.06
    width = (10.0 - gap_x * (columns - 1)) / columns
    height = (3.0 - gap_z * (rows - 1)) / rows
    for row in range(rows):
        for column in range(columns):
            if row == rows - 1 and column in (1, 6):
                continue
            x = -5.0 + width / 2 + column * (width + gap_x)
            z = height / 2 + row * (height + gap_z)
            cube(
                f"wall_lod0_stone_{row:02d}_{column:02d}",
                (width, 1.5, height),
                (x, 0, z),
                collection,
                lod0,
                moss if row == rows - 1 and column % 3 == 0 else stone,
                bevel=0.045,
            )
    cube("wall_lod1_shell", (10.0, 1.5, 3.0), (0, 0, 1.5), collection, lod1, stone)
    collider(asset_id, collection, root, "box", True, (9.8, 2.9, 1.35))
    return root


def arch_blocks(
    prefix: str,
    collection: bpy.types.Collection,
    parent: bpy.types.Object,
    mat: bpy.types.Material,
    bevel: float,
    segments: int,
) -> None:
    pier_rows = 4 if parent.get("lod") == "LOD0" else 2
    for side in (-1, 1):
        for row in range(pier_rows):
            height = 0.72 if pier_rows == 4 else 1.45
            cube(
                f"{prefix}_pier_{side}_{row}",
                (1.3, 2.0, height),
                (side * 2.35, 0, height / 2 + row * height),
                collection,
                parent,
                mat,
                bevel=bevel,
            )
    center_z = 2.85
    radius = 1.85
    for index in range(segments):
        angle = math.pi * index / (segments - 1)
        cube(
            f"{prefix}_vault_{index:02d}",
            (0.88, 2.0, 0.78),
            (radius * math.cos(angle), 0, center_z + radius * math.sin(angle)),
            collection,
            parent,
            mat,
            rotation=(0, angle - math.pi / 2, 0),
            bevel=bevel,
        )


def build_arch(stone: bpy.types.Material, moss: bpy.types.Material) -> bpy.types.Object:
    asset_id = ASSET_IDS[2]
    collection, root, lod0, lod1 = asset_roots(asset_id)
    root["dimensions_meters"] = [6.0, 5.0, 2.0]
    arch_blocks("arch_lod0", collection, lod0, stone, 0.055, 9)
    cube("arch_lod0_moss_cap", (1.4, 2.0, 0.16), (0, 0, 4.9), collection, lod0, moss, bevel=0.03)
    arch_blocks("arch_lod1", collection, lod1, stone, 0.0, 7)
    collider(asset_id, collection, root, "none", False, (0, 0, 0))
    return root


def descendants(root: bpy.types.Object) -> list[bpy.types.Object]:
    result: list[bpy.types.Object] = []
    stack = [root]
    while stack:
        current = stack.pop()
        result.append(current)
        stack.extend(current.children)
    return result


def export_asset(root: bpy.types.Object, path: Path) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    selected = descendants(root)
    prior_hide = {obj.name: obj.hide_render for obj in selected}
    for obj in selected:
        obj.hide_render = False
        obj.hide_set(False)
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_extras=True,
        export_yup=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_animations=False,
    )
    for obj in selected:
        obj.hide_render = prior_hide[obj.name]


def triangulated_count(root: bpy.types.Object) -> int:
    total = 0
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj in descendants(root):
        if obj.type != "MESH":
            continue
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        total += len(mesh.loop_triangles)
        evaluated.to_mesh_clear()
    return total


def build_preview(roots: list[bpy.types.Object], screenshot_path: Path) -> None:
    scene = bpy.context.scene
    preview = bpy.data.collections.new("Phase_A0_Preview")
    scene.collection.children.link(preview)
    offsets = (-12.0, 0.0, 11.0)
    for root, offset in zip(roots, offsets):
        lod0 = next(child for child in root.children if child.get("lod") == "LOD0")
        for source in descendants(lod0):
            if source.type != "MESH":
                continue
            duplicate = source.copy()
            duplicate.data = source.data.copy()
            duplicate.parent = None
            duplicate.matrix_world = source.matrix_world.copy()
            duplicate.location.x += offset
            preview.objects.link(duplicate)
    for root in roots:
        for obj in descendants(root):
            obj.hide_render = True

    ground_mat = material("preview_ground", (0.035, 0.055, 0.065, 1.0), 0.95)
    cube("preview_ground", (36, 14, 0.18), (0, 0, -0.09), preview, make_empty("preview_root", preview), ground_mat)

    bpy.ops.object.light_add(type="SUN", location=(0, -8, 16))
    sun = bpy.context.object
    sun.name = "preview_sun"
    sun.data.energy = 2.1
    sun.rotation_euler = (math.radians(28), math.radians(-18), math.radians(-32))

    bpy.ops.object.light_add(type="AREA", location=(-5, -10, 12))
    area = bpy.context.object
    area.name = "preview_fill"
    area.data.energy = 1150
    area.data.shape = "DISK"
    area.data.size = 8
    direction = Vector((0, 0, 3.2)) - area.location
    area.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()

    bpy.ops.object.camera_add(location=(23, -40, 21))
    camera = bpy.context.object
    camera.name = "preview_camera"
    camera.data.lens = 48
    camera.rotation_euler = (Vector((0, 0, 3.8)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera
    scene.render.filepath = str(screenshot_path)
    scene.view_settings.look = "AgX - Medium High Contrast"
    bpy.ops.render.render(write_still=True)


def main() -> None:
    args = args_after_separator()
    # Keep a supplied Windows drive alias intact. Resolving the workspace's
    # subst drive expands past Blender/Python's legacy path-length boundary.
    repo_root = Path(args.repo_root)
    source_path = repo_root / "art" / "blender" / "falkmoor_ruins.blend"
    export_root = repo_root / "public" / "assets" / "models" / "environment" / "falkmoor"
    screenshot_path = repo_root / "docs" / "screenshots" / "asset_phase_a0_falkmoor_pilot.png"
    source_path.parent.mkdir(parents=True, exist_ok=True)
    export_root.mkdir(parents=True, exist_ok=True)
    screenshot_path.parent.mkdir(parents=True, exist_ok=True)

    clean_scene()
    stone = material("mat_falkmoor_weathered_stone", (0.22, 0.255, 0.275, 1.0), 0.88)
    moss = material("mat_falkmoor_moss_and_shadow", (0.075, 0.12, 0.09, 1.0), 0.96)
    roots = [build_tower(stone, moss), build_wall(stone, moss), build_arch(stone, moss)]

    for root in roots:
        lod0 = next(child for child in root.children if child.get("lod") == "LOD0")
        lod1 = next(child for child in root.children if child.get("lod") == "LOD1")
        print(f"CLAURIM {root.name}: LOD0={triangulated_count(lod0)} LOD1={triangulated_count(lod1)}")
        export_asset(root, export_root / f"{root.name}.glb")

    bpy.ops.wm.save_as_mainfile(filepath=str(source_path), compress=True)
    build_preview(roots, screenshot_path)
    print(f"CLAURIM source={source_path}")
    print(f"CLAURIM preview={screenshot_path}")


if __name__ == "__main__":
    main()
