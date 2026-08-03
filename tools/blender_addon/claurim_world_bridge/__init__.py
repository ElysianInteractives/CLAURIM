"""Claurim world round-trip bridge for Blender 5.2 LTS.

The bridge imports authoritative TypeScript content as an editable reference
scene and exports proposal-only placement metadata. It never changes runtime
collision or terrain authority by itself.
"""

from __future__ import annotations

import json
import math
import re
import subprocess
import webbrowser
from pathlib import Path
from typing import Any, Iterable

import bpy
from mathutils import Vector


bl_info = {
    "name": "Claurim World Bridge",
    "author": "Elysian Interactives",
    "version": (1, 0, 0),
    "blender": (5, 2, 0),
    "location": "View3D > Sidebar > Claurim",
    "description": "Import, place, validate, and export Claurim world metadata",
    "category": "Game Engine",
}


WORLD_ROOT = "CLAURIM_WORLD"
PALETTE_ROOT = "_CLAURIM_ASSET_PALETTE"
SNAPSHOT_TEXT = "CLAURIM_CURRENT_WORLD.json"
PLACEMENT_ID = re.compile(r"^[a-z][a-z0-9_-]*$")
COLLECTION_BY_TYPE = {
    "prop": "Props",
    "door": "Doors",
    "container": "Containers",
    "spawner": "Spawners",
    "landmark": "Landmarks",
}
DISPLAY_BY_TYPE = {
    "door": (0.25, 0.7, 1.0, 1.0),
    "container": (0.85, 0.55, 0.2, 1.0),
    "spawner": (1.0, 0.2, 0.2, 1.0),
    "landmark": (0.75, 0.35, 1.0, 1.0),
}


def repo_root_from_scene(scene: bpy.types.Scene) -> Path:
    configured = str(getattr(scene, "claurim_repo_root", "")).strip()
    if configured:
        return Path(configured)
    if bpy.data.filepath:
        candidate = Path(bpy.data.filepath).parent
        for parent in (candidate, *candidate.parents):
            if (parent / "art" / "world" / "current-world.json").exists():
                return parent
    return Path.cwd()


def snapshot_path(repo_root: Path) -> Path:
    return repo_root / "art" / "world" / "current-world.json"


def export_path(repo_root: Path) -> Path:
    return repo_root / "art" / "world" / "blender-world-export.json"


def load_snapshot(repo_root: Path) -> dict[str, Any]:
    with snapshot_path(repo_root).open("r", encoding="utf-8") as handle:
        return json.load(handle)


def snapshot_from_scene(scene: bpy.types.Scene) -> dict[str, Any]:
    text = bpy.data.texts.get(SNAPSHOT_TEXT)
    if text:
        return json.loads(text.as_string())
    return load_snapshot(repo_root_from_scene(scene))


def replace_snapshot_text(snapshot: dict[str, Any]) -> None:
    old = bpy.data.texts.get(SNAPSHOT_TEXT)
    if old:
        bpy.data.texts.remove(old)
    text = bpy.data.texts.new(SNAPSHOT_TEXT)
    text.write(json.dumps(snapshot, indent=2) + "\n")
    text.use_module = False


def unlink_and_remove_collection(collection: bpy.types.Collection) -> None:
    for child in tuple(collection.children):
        unlink_and_remove_collection(child)
    for obj in tuple(collection.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.collections.remove(collection)


def remove_named_collection(name: str) -> None:
    collection = bpy.data.collections.get(name)
    if collection:
        unlink_and_remove_collection(collection)


def new_child(parent: bpy.types.Collection, name: str) -> bpy.types.Collection:
    collection = bpy.data.collections.new(name)
    parent.children.link(collection)
    return collection


def link_object(collection: bpy.types.Collection, obj: bpy.types.Object) -> None:
    for owner in tuple(obj.users_collection):
        owner.objects.unlink(obj)
    collection.objects.link(obj)


def unit_proxy_mesh() -> bpy.types.Mesh:
    existing = bpy.data.meshes.get("CLAURIM_Unit_Ground_Box")
    if existing:
        return existing
    mesh = bpy.data.meshes.new("CLAURIM_Unit_Ground_Box")
    mesh.from_pydata(
        [
            (-0.5, -0.5, 0), (0.5, -0.5, 0), (0.5, 0.5, 0), (-0.5, 0.5, 0),
            (-0.5, -0.5, 1), (0.5, -0.5, 1), (0.5, 0.5, 1), (-0.5, 0.5, 1),
        ],
        [],
        [
            (0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1),
            (1, 5, 6, 2), (2, 6, 7, 3), (4, 0, 3, 7),
        ],
    )
    mesh.update()
    return mesh


def material(name: str, color: tuple[float, float, float, float]) -> bpy.types.Material:
    existing = bpy.data.materials.get(name)
    if existing:
        return existing
    result = bpy.data.materials.new(name)
    result.diffuse_color = color
    result.use_nodes = True
    shader = result.node_tree.nodes.get("Principled BSDF") if result.node_tree else None
    if shader:
        shader.inputs["Base Color"].default_value = color
        shader.inputs["Roughness"].default_value = 0.88
    return result


def terrain_height(reference: dict[str, Any], x: float, z: float) -> float:
    step = float(reference["stepMeters"])
    columns = int(reference["columns"])
    rows = int(reference["rows"])
    fx = max(0.0, min(columns - 1.0, (x - float(reference["minX"])) / step))
    fz = max(0.0, min(rows - 1.0, (z - float(reference["minZ"])) / step))
    x0, z0 = int(math.floor(fx)), int(math.floor(fz))
    x1, z1 = min(columns - 1, x0 + 1), min(rows - 1, z0 + 1)
    tx, tz = fx - x0, fz - z0
    heights = reference["heights"]
    h00 = float(heights[z0 * columns + x0])
    h10 = float(heights[z0 * columns + x1])
    h01 = float(heights[z1 * columns + x0])
    h11 = float(heights[z1 * columns + x1])
    return (h00 * (1 - tx) + h10 * tx) * (1 - tz) + (h01 * (1 - tx) + h11 * tx) * tz


def build_terrain(reference: dict[str, Any], collection: bpy.types.Collection) -> bpy.types.Object:
    columns = int(reference["columns"])
    rows = int(reference["rows"])
    step = float(reference["stepMeters"])
    min_x = float(reference["minX"])
    min_z = float(reference["minZ"])
    vertices = []
    for row in range(rows):
        for column in range(columns):
            vertices.append((
                min_x + column * step,
                min_z + row * step,
                float(reference["heights"][row * columns + column]),
            ))
    faces = []
    for row in range(rows - 1):
        for column in range(columns - 1):
            lower = row * columns + column
            faces.append((lower, lower + 1, lower + columns + 1, lower + columns))
    mesh = bpy.data.meshes.new("kaldwyn_terrain_reference_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new("kaldwyn_terrain_reference", mesh)
    obj["claurim_type"] = "terrain_reference"
    obj["claurim_authority"] = "read_only"
    obj["claurim_seed"] = int(reference["seed"])
    mesh.materials.append(material("mat_claurim_terrain_reference", (0.16, 0.27, 0.12, 1.0)))
    collection.objects.link(obj)
    return obj


def build_road(road: dict[str, Any], collection: bpy.types.Collection, terrain: dict[str, Any]) -> bpy.types.Object:
    curve = bpy.data.curves.new(road["id"], "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = 1.8
    curve.bevel_resolution = 2
    spline = curve.splines.new("POLY")
    points = road["points"]
    spline.points.add(len(points) - 1)
    for point, source in zip(spline.points, points):
        point.co = (
            float(source["x"]),
            float(source["z"]),
            terrain_height(terrain, float(source["x"]), float(source["z"])) + 0.08,
            1.0,
        )
    obj = bpy.data.objects.new(road["id"], curve)
    obj["claurim_type"] = "road_reference"
    obj["claurim_id"] = road["id"]
    obj["claurim_space_id"] = road["spaceId"]
    curve.materials.append(material("mat_claurim_road_reference", (0.25, 0.19, 0.12, 1.0)))
    collection.objects.link(obj)
    return obj


def build_room_proxy(room: dict[str, Any], index: int, collection: bpy.types.Collection, ceiling: float) -> None:
    obj = bpy.data.objects.new(f"room_{index:02d}", unit_proxy_mesh())
    width = float(room["x1"]) - float(room["x0"])
    depth = float(room["z1"]) - float(room["z0"])
    obj.location = ((room["x0"] + room["x1"]) / 2, (room["z0"] + room["z1"]) / 2, 0)
    obj.scale = (width, depth, ceiling)
    obj.display_type = "WIRE"
    obj.color = (0.1, 0.5, 0.7, 0.22)
    obj["claurim_type"] = "room_reference"
    collection.objects.link(obj)


def imported_asset_collection(asset: dict[str, Any], repo_root: Path) -> bpy.types.Collection:
    name = f"CLAURIM_ASSET__{asset['id']}"
    existing = bpy.data.collections.get(name)
    if existing:
        return existing
    collection = bpy.data.collections.new(name)
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(repo_root / "public" / asset["glbPath"]))
    imported = set(bpy.data.objects) - before
    for obj in imported:
        link_object(collection, obj)
        if "__LOD1" in obj.name or "__COLLIDER" in obj.name:
            obj.hide_render = True
            obj.hide_viewport = True
        obj["claurim_asset_source"] = asset["id"]
    collection["claurim_asset_id"] = asset["id"]
    collection["claurim_license"] = asset["license"]
    collection["claurim_author"] = asset["author"]
    try:
        collection.asset_mark()
        if collection.asset_data:
            collection.asset_data.description = f"Claurim approved asset: {asset['id']}"
    except (AttributeError, RuntimeError):
        pass
    return collection


def build_palette(snapshot: dict[str, Any], repo_root: Path) -> dict[str, bpy.types.Collection]:
    remove_named_collection(PALETTE_ROOT)
    root = bpy.data.collections.new(PALETTE_ROOT)
    result: dict[str, bpy.types.Collection] = {}
    for asset in snapshot["assets"]:
        collection = imported_asset_collection(asset, repo_root)
        root.children.link(collection)
        result[asset["id"]] = collection
    return result


def set_placement_metadata(obj: bpy.types.Object, placement: dict[str, Any]) -> None:
    obj["claurim_type"] = placement["recordType"]
    obj["claurim_id"] = placement["id"]
    obj["claurim_space_id"] = placement["spaceId"]
    obj["claurim_kind"] = placement["kind"]
    obj["claurim_grounded"] = bool(placement.get("grounded", False))
    obj["claurim_data_json"] = json.dumps(placement.get("data", {}), separators=(",", ":"))
    if placement.get("assetId"):
        obj["claurim_asset_id"] = placement["assetId"]
    if placement.get("solid") is not None:
        obj["claurim_solid"] = bool(placement["solid"])
    transform = placement["transform"]
    obj.location = (float(transform["x"]), float(transform["z"]), float(transform["y"]))
    obj.rotation_euler = (0, 0, float(transform["yaw"]))


def create_placement_object(
    placement: dict[str, Any],
    collection: bpy.types.Collection,
    assets: dict[str, dict[str, Any]],
    palette: dict[str, bpy.types.Collection],
) -> bpy.types.Object:
    record_type = placement["recordType"]
    asset_id = placement.get("assetId")
    if record_type == "prop" and asset_id in palette:
        obj = bpy.data.objects.new(placement["id"], None)
        obj.instance_type = "COLLECTION"
        obj.instance_collection = palette[asset_id]
        base = assets[asset_id]["dimensionsMeters"]
        dimensions = placement["dimensions"]
        obj.scale = (
            float(dimensions[0]) / float(base[0]),
            float(dimensions[2]) / float(base[2]),
            float(dimensions[1]) / float(base[1]),
        )
        obj["claurim_base_dimensions"] = list(base)
    elif record_type == "prop":
        obj = bpy.data.objects.new(placement["id"], unit_proxy_mesh())
        dimensions = placement["dimensions"]
        obj.scale = (float(dimensions[0]), float(dimensions[2]), float(dimensions[1]))
        obj["claurim_base_dimensions"] = [1.0, 1.0, 1.0]
        obj.display_type = "WIRE"
        obj.color = (0.55, 0.58, 0.62, 0.35)
    else:
        obj = bpy.data.objects.new(placement["id"], None)
        obj.empty_display_type = {
            "door": "SINGLE_ARROW",
            "container": "CUBE",
            "spawner": "CIRCLE",
            "landmark": "SPHERE",
        }.get(record_type, "PLAIN_AXES")
        obj.empty_display_size = 1.2 if record_type != "spawner" else max(1.2, float(placement.get("data", {}).get("radius", 1)))
        obj.color = DISPLAY_BY_TYPE.get(record_type, (1, 1, 1, 1))
    set_placement_metadata(obj, placement)
    collection.objects.link(obj)
    return obj


def build_world_scene(repo_root: Path, snapshot: dict[str, Any] | None = None) -> dict[str, int]:
    snapshot = snapshot or load_snapshot(repo_root)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.unit_settings.length_unit = "METERS"
    scene.claurim_repo_root = str(repo_root)
    scene["claurim_bridge_version"] = "1.0.0"
    scene["claurim_content_version"] = snapshot["contentVersion"]
    scene["claurim_runtime_authority"] = "proposal"
    replace_snapshot_text(snapshot)
    remove_named_collection(WORLD_ROOT)
    world = bpy.data.collections.new(WORLD_ROOT)
    scene.collection.children.link(world)
    palette = build_palette(snapshot, repo_root)
    assets = {asset["id"]: asset for asset in snapshot["assets"]}
    terrain_by_space = {reference["spaceId"]: reference for reference in snapshot["terrainReferences"]}
    objects_by_key: dict[tuple[str, str], bpy.types.Object] = {}

    for space in snapshot["spaces"]:
        space_collection = new_child(world, f"SPACE__{space['id']}")
        space_collection["claurim_space_id"] = space["id"]
        categories = {name: new_child(space_collection, name) for name in COLLECTION_BY_TYPE.values()}
        reference_collection = new_child(space_collection, "References")
        if space["id"] in terrain_by_space:
            build_terrain(terrain_by_space[space["id"]], reference_collection)
        for index, room in enumerate(space.get("rooms", [])):
            build_room_proxy(room, index, reference_collection, float(space.get("ceilingY") or 4))
        for placement in snapshot["placements"]:
            if placement["spaceId"] != space["id"]:
                continue
            target = categories[COLLECTION_BY_TYPE[placement["recordType"]]]
            obj = create_placement_object(placement, target, assets, palette)
            objects_by_key[(placement["recordType"], placement["id"])] = obj
        if space["kind"] == "interior":
            space_collection.hide_render = True

    kaldwyn = bpy.data.collections.get("SPACE__kaldwyn")
    terrain = terrain_by_space.get("kaldwyn")
    if kaldwyn and terrain:
        references = next((child for child in kaldwyn.children if child.name == "References"), None)
        if references:
            for road in snapshot["roads"]:
                if road["spaceId"] == "kaldwyn":
                    build_road(road, references, terrain)

    bpy.context.view_layer.update()
    for placement in snapshot["placements"]:
        if placement["recordType"] != "door":
            continue
        anchor_id = placement.get("data", {}).get("anchor_prop_id")
        door = objects_by_key.get(("door", placement["id"]))
        parent = objects_by_key.get(("prop", anchor_id)) if anchor_id else None
        if door and parent:
            world_matrix = door.matrix_world.copy()
            door.parent = parent
            door.matrix_world = world_matrix

    scene.claurim_space_id = "kaldwyn"
    if snapshot["assets"]:
        scene.claurim_asset_id = snapshot["assets"][0]["id"]
    validate_world(scene)
    return {
        "spaces": len(snapshot["spaces"]),
        "placements": len(snapshot["placements"]),
        "assets": len(snapshot["assets"]),
    }


def placement_objects() -> list[bpy.types.Object]:
    return [obj for obj in bpy.data.objects if obj.get("claurim_type") in COLLECTION_BY_TYPE]


def object_world_transform(obj: bpy.types.Object) -> tuple[float, float, float, float]:
    matrix = obj.matrix_world
    location = matrix.translation
    yaw = matrix.to_euler("XYZ").z
    return location.x, location.z, location.y, yaw


def rounded(value: float) -> float | int:
    value = round(float(value), 6)
    return int(value) if value.is_integer() else value


def placement_from_object(obj: bpy.types.Object) -> dict[str, Any]:
    x, y, z, yaw = object_world_transform(obj)
    record_type = str(obj["claurim_type"])
    placement: dict[str, Any] = {
        "recordType": record_type,
        "id": str(obj.get("claurim_id", obj.name)),
        "spaceId": str(obj.get("claurim_space_id", "")),
        "kind": str(obj.get("claurim_kind", record_type)),
        "transform": {"x": rounded(x), "y": rounded(y), "z": rounded(z), "yaw": rounded(yaw)},
    }
    if record_type == "prop":
        base = list(obj.get("claurim_base_dimensions", [1.0, 1.0, 1.0]))
        placement["dimensions"] = [
            rounded(abs(float(base[0]) * obj.scale.x)),
            rounded(abs(float(base[1]) * obj.scale.z)),
            rounded(abs(float(base[2]) * obj.scale.y)),
        ]
        placement["solid"] = bool(obj.get("claurim_solid", False))
        asset_id = str(obj.get("claurim_asset_id", ""))
        if asset_id:
            placement["assetId"] = asset_id
    placement["grounded"] = bool(obj.get("claurim_grounded", False))
    try:
        placement["data"] = json.loads(str(obj.get("claurim_data_json", "{}")))
    except json.JSONDecodeError:
        placement["data"] = {}
    return placement


def current_export(scene: bpy.types.Scene) -> dict[str, Any]:
    bpy.context.view_layer.update()
    snapshot = snapshot_from_scene(scene)
    placements = [placement_from_object(obj) for obj in placement_objects()]
    placements.sort(key=lambda item: (item["spaceId"], item["recordType"], item["id"]))
    return {
        "schemaVersion": int(snapshot["schemaVersion"]),
        "sourceContentVersion": snapshot["contentVersion"],
        "exportedBy": "Claurim Blender Bridge 1.0.0",
        "runtimeAuthority": "proposal",
        "placements": placements,
    }


def nearest_terrain(snapshot: dict[str, Any], space_id: str) -> dict[str, Any] | None:
    return next((reference for reference in snapshot["terrainReferences"] if reference["spaceId"] == space_id), None)


def asset_triangles(collection: bpy.types.Collection, node_name: str) -> int:
    root = next((obj for obj in collection.all_objects if obj.name == node_name), None)
    if not root:
        return 0
    descendants = {root, *root.children_recursive}
    return sum(len(obj.data.loop_triangles) if obj.data.loop_triangles else len(obj.data.polygons) * 2
               for obj in descendants if obj.type == "MESH")


def validate_world(scene: bpy.types.Scene, selected_only: bool = False) -> tuple[list[str], list[str]]:
    bpy.context.view_layer.update()
    snapshot = snapshot_from_scene(scene)
    spaces = {space["id"] for space in snapshot["spaces"]}
    assets = {asset["id"]: asset for asset in snapshot["assets"]}
    known_baseline = {(item["recordType"], item["id"]) for item in snapshot["placements"]}
    all_objects = placement_objects()
    objects = [obj for obj in all_objects if not selected_only or obj.select_get()]
    errors: list[str] = []
    warnings: list[str] = []
    seen: set[tuple[str, str]] = set()
    prop_spaces: dict[str, str] = {
        str(obj.get("claurim_id", "")): str(obj.get("claurim_space_id", ""))
        for obj in all_objects if obj.get("claurim_type") == "prop"
    }
    for obj in objects:
        record_type = str(obj.get("claurim_type", ""))
        item_id = str(obj.get("claurim_id", ""))
        prefix = f"{record_type}:{item_id or obj.name}"
        key = (record_type, item_id)
        if key in seen:
            errors.append(f"{prefix}: duplicate ID")
        seen.add(key)
        if not PLACEMENT_ID.match(item_id):
            errors.append(f"{prefix}: invalid stable ID")
        space_id = str(obj.get("claurim_space_id", ""))
        if space_id not in spaces:
            errors.append(f"{prefix}: unknown space {space_id}")
        if abs(obj.rotation_euler.x) > 1e-4 or abs(obj.rotation_euler.y) > 1e-4:
            errors.append(f"{prefix}: placement may rotate only around Blender Z")
        if min(obj.scale) <= 0:
            errors.append(f"{prefix}: scale must stay positive")
        asset_id = str(obj.get("claurim_asset_id", ""))
        if asset_id and asset_id not in assets:
            errors.append(f"{prefix}: unlicensed or unknown asset {asset_id}")
        if key not in known_baseline and (record_type != "prop" or not asset_id):
            errors.append(f"{prefix}: new A2 placements must be asset-backed props")
        if bool(obj.get("claurim_grounded", False)):
            reference = nearest_terrain(snapshot, space_id)
            if reference:
                x, y, z, _yaw = object_world_transform(obj)
                expected = terrain_height(reference, x, z)
                # The read-only reference mesh samples D-005 at an 8 m grid;
                # allow its bounded interpolation error while still rejecting
                # visible floating/buried placement drift.
                if abs(y - expected) > 1.25:
                    errors.append(f"{prefix}: {abs(y - expected):.2f} m from reference terrain; use Snap Selected")

    for obj in objects:
        if obj.get("claurim_type") != "door":
            continue
        data = json.loads(str(obj.get("claurim_data_json", "{}")))
        anchor_id = data.get("anchor_prop_id")
        if anchor_id and prop_spaces.get(anchor_id) != obj.get("claurim_space_id"):
            errors.append(f"door:{obj.get('claurim_id')}: missing or cross-space anchor {anchor_id}")

    if not selected_only:
        for asset_id, asset in assets.items():
            collection = bpy.data.collections.get(f"CLAURIM_ASSET__{asset_id}")
            if not collection:
                errors.append(f"asset:{asset_id}: palette collection missing")
                continue
            if not collection.get("claurim_license"):
                errors.append(f"asset:{asset_id}: license metadata missing")
            for lod in asset["lods"]:
                triangles = asset_triangles(collection, lod["node"])
                if triangles <= 0:
                    errors.append(f"asset:{asset_id}: missing {lod['name']} geometry")
                elif triangles > int(lod["maxTriangles"]):
                    errors.append(f"asset:{asset_id}: {lod['name']} has {triangles} triangles; budget {lod['maxTriangles']}")
            for obj in collection.all_objects:
                if obj.type != "MESH":
                    continue
                for mat in obj.data.materials:
                    if mat and (not mat.use_nodes or not mat.node_tree.nodes.get("Principled BSDF")):
                        errors.append(f"asset:{asset_id}: material {mat.name} is not Principled BSDF")

    scene.claurim_validation_summary = f"{len(errors)} errors, {len(warnings)} warnings"
    scene["claurim_validation_errors"] = "\n".join(errors)
    scene["claurim_validation_warnings"] = "\n".join(warnings)
    return errors, warnings


def write_world_export(scene: bpy.types.Scene, run_repository_validator: bool = True) -> Path:
    repo_root = repo_root_from_scene(scene)
    output = export_path(repo_root)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(current_export(scene), indent=2) + "\n", encoding="utf-8")
    if run_repository_validator:
        executable = "npm.cmd" if bpy.app.build_platform.startswith(b"Windows") else "npm"
        completed = subprocess.run(
            [executable, "run", "validate:blender-world"],
            cwd=repo_root,
            capture_output=True,
            text=True,
            check=False,
        )
        scene["claurim_repository_validation"] = (completed.stdout + completed.stderr).strip()
        if completed.returncode != 0:
            raise RuntimeError(scene["claurim_repository_validation"])
    return output


def space_items(_self: Any, context: bpy.types.Context) -> list[tuple[str, str, str]]:
    try:
        snapshot = snapshot_from_scene(context.scene)
        return [(space["id"], space["name"], space["kind"]) for space in snapshot["spaces"]]
    except Exception:
        return [("kaldwyn", "Kaldwyn Reach", "Exterior")]


def asset_items(_self: Any, context: bpy.types.Context) -> list[tuple[str, str, str]]:
    try:
        snapshot = snapshot_from_scene(context.scene)
        return [(asset["id"], asset["id"].replace("_", " ").title(), asset["license"]) for asset in snapshot["assets"]]
    except Exception:
        return []


class CLAURIM_OT_import_current_world(bpy.types.Operator):
    bl_idname = "claurim.import_current_world"
    bl_label = "Import Current World"
    bl_description = "Rebuild editable Claurim collections from the repository snapshot"
    bl_options = {"REGISTER", "UNDO"}

    def execute(self, context: bpy.types.Context) -> set[str]:
        try:
            counts = build_world_scene(repo_root_from_scene(context.scene))
            self.report({"INFO"}, f"Imported {counts['placements']} placements and {counts['assets']} assets")
            return {"FINISHED"}
        except Exception as error:
            self.report({"ERROR"}, str(error))
            return {"CANCELLED"}


class CLAURIM_OT_place_asset(bpy.types.Operator):
    bl_idname = "claurim.place_asset"
    bl_label = "Place Palette Asset"
    bl_description = "Create an editable collection instance at the 3D cursor"
    bl_options = {"REGISTER", "UNDO"}

    def execute(self, context: bpy.types.Context) -> set[str]:
        scene = context.scene
        snapshot = snapshot_from_scene(scene)
        asset = next((item for item in snapshot["assets"] if item["id"] == scene.claurim_asset_id), None)
        collection = bpy.data.collections.get(f"CLAURIM_ASSET__{scene.claurim_asset_id}")
        space = bpy.data.collections.get(f"SPACE__{scene.claurim_space_id}")
        props = next((child for child in space.children if child.name == "Props"), None) if space else None
        if not asset or not collection or not props:
            self.report({"ERROR"}, "Import Current World before placing an asset")
            return {"CANCELLED"}
        base_id = f"placed_{scene.claurim_asset_id}"
        used = {str(obj.get("claurim_id", "")) for obj in placement_objects()}
        item_id = base_id
        index = 2
        while item_id in used:
            item_id = f"{base_id}_{index}"
            index += 1
        cursor = scene.cursor.location
        y = cursor.z
        reference = nearest_terrain(snapshot, scene.claurim_space_id)
        if reference:
            y = terrain_height(reference, cursor.x, cursor.y)
        placement = {
            "recordType": "prop",
            "id": item_id,
            "spaceId": scene.claurim_space_id,
            "kind": "asset_prop",
            "transform": {"x": cursor.x, "y": y, "z": cursor.y, "yaw": 0},
            "dimensions": list(asset["dimensionsMeters"]),
            "solid": False,
            "assetId": asset["id"],
            "grounded": bool(reference),
            "data": {},
        }
        obj = create_placement_object(placement, props, {asset["id"]: asset}, {asset["id"]: collection})
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        self.report({"INFO"}, f"Placed {item_id}; edit its ID and transform in the Claurim panel")
        return {"FINISHED"}


class CLAURIM_OT_snap_selected(bpy.types.Operator):
    bl_idname = "claurim.snap_selected"
    bl_label = "Snap Selected to Reference Terrain"
    bl_options = {"REGISTER", "UNDO"}

    def execute(self, context: bpy.types.Context) -> set[str]:
        snapshot = snapshot_from_scene(context.scene)
        count = 0
        for obj in context.selected_objects:
            space_id = str(obj.get("claurim_space_id", ""))
            reference = nearest_terrain(snapshot, space_id)
            if not reference:
                continue
            world = obj.matrix_world.translation
            world.z = terrain_height(reference, world.x, world.y)
            obj.matrix_world.translation = world
            obj["claurim_grounded"] = True
            count += 1
        self.report({"INFO"}, f"Snapped {count} placements")
        return {"FINISHED"}


class CLAURIM_OT_validate_world(bpy.types.Operator):
    bl_idname = "claurim.validate_world"
    bl_label = "Validate World"

    selected_only: bpy.props.BoolProperty(name="Selected Only", default=False)

    def execute(self, context: bpy.types.Context) -> set[str]:
        errors, warnings = validate_world(context.scene, self.selected_only)
        if errors:
            self.report({"ERROR"}, f"{len(errors)} errors; see Scene custom properties")
            return {"CANCELLED"}
        self.report({"INFO"}, f"World valid ({len(warnings)} warnings)")
        return {"FINISHED"}


class CLAURIM_OT_export_world(bpy.types.Operator):
    bl_idname = "claurim.export_world"
    bl_label = "Export Claurim World"
    bl_description = "Write proposal placement metadata and run repository validation"

    def execute(self, context: bpy.types.Context) -> set[str]:
        errors, _warnings = validate_world(context.scene)
        if errors:
            self.report({"ERROR"}, f"Fix {len(errors)} validation errors before export")
            return {"CANCELLED"}
        try:
            output = write_world_export(context.scene, context.scene.claurim_run_repository_validation)
            if context.scene.claurim_open_qa:
                webbrowser.open(context.scene.claurim_qa_url)
            self.report({"INFO"}, f"Exported {output.name}")
            return {"FINISHED"}
        except Exception as error:
            self.report({"ERROR"}, str(error)[:240])
            return {"CANCELLED"}


class CLAURIM_PT_world_bridge(bpy.types.Panel):
    bl_label = "Claurim World Bridge"
    bl_idname = "CLAURIM_PT_world_bridge"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "Claurim"

    def draw(self, context: bpy.types.Context) -> None:
        layout = self.layout
        scene = context.scene
        layout.prop(scene, "claurim_repo_root")
        layout.operator("claurim.import_current_world", icon="IMPORT")
        layout.separator()
        box = layout.box()
        box.label(text="Asset Palette", icon="ASSET_MANAGER")
        box.prop(scene, "claurim_space_id")
        box.prop(scene, "claurim_asset_id")
        box.operator("claurim.place_asset", icon="OUTLINER_COLLECTION")
        active = context.active_object
        if active and active.get("claurim_type") in COLLECTION_BY_TYPE:
            box = layout.box()
            box.label(text="Selected Placement", icon="OBJECT_DATA")
            box.prop(active, '["claurim_id"]', text="Claurim ID")
            box.prop(active, '["claurim_space_id"]', text="Space")
            box.prop(active, '["claurim_kind"]', text="Kind")
            if active.get("claurim_asset_id"):
                box.prop(active, '["claurim_asset_id"]', text="Asset")
            box.operator("claurim.snap_selected", icon="SNAP_ON")
        layout.separator()
        row = layout.row(align=True)
        operator = row.operator("claurim.validate_world", text="Validate Selection")
        operator.selected_only = True
        operator = row.operator("claurim.validate_world", text="Validate World")
        operator.selected_only = False
        layout.label(text=scene.claurim_validation_summary)
        layout.prop(scene, "claurim_run_repository_validation")
        layout.prop(scene, "claurim_open_qa")
        if scene.claurim_open_qa:
            layout.prop(scene, "claurim_qa_url")
        layout.operator("claurim.export_world", icon="EXPORT")
        layout.label(text="A2 exports are proposal-only", icon="INFO")


CLASSES = (
    CLAURIM_OT_import_current_world,
    CLAURIM_OT_place_asset,
    CLAURIM_OT_snap_selected,
    CLAURIM_OT_validate_world,
    CLAURIM_OT_export_world,
    CLAURIM_PT_world_bridge,
)


def register() -> None:
    for cls in CLASSES:
        bpy.utils.register_class(cls)
    bpy.types.Scene.claurim_repo_root = bpy.props.StringProperty(name="Repository", subtype="DIR_PATH")
    bpy.types.Scene.claurim_space_id = bpy.props.EnumProperty(name="Space", items=space_items)
    bpy.types.Scene.claurim_asset_id = bpy.props.EnumProperty(name="Approved Asset", items=asset_items)
    bpy.types.Scene.claurim_validation_summary = bpy.props.StringProperty(name="Validation", default="Not validated")
    bpy.types.Scene.claurim_run_repository_validation = bpy.props.BoolProperty(
        name="Run repository validator", default=True,
    )
    bpy.types.Scene.claurim_open_qa = bpy.props.BoolProperty(name="Open QA after export", default=False)
    bpy.types.Scene.claurim_qa_url = bpy.props.StringProperty(
        name="QA URL", default="http://127.0.0.1:5173/?qa=falkmoor",
    )


def unregister() -> None:
    for name in (
        "claurim_qa_url", "claurim_open_qa", "claurim_run_repository_validation",
        "claurim_validation_summary", "claurim_asset_id", "claurim_space_id", "claurim_repo_root",
    ):
        if hasattr(bpy.types.Scene, name):
            delattr(bpy.types.Scene, name)
    for cls in reversed(CLASSES):
        bpy.utils.unregister_class(cls)


if __name__ == "__main__":
    register()
