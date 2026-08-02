# Blender asset authoring contract

Asset Phase A0 locks a reproducible Blender-to-GLB source boundary without
changing the live renderer, simulation authority, collision, placement,
terrain, protocols, saves, or content. The pilot proves that editable art can
be versioned, exported, measured, and rejected before Phase A1 loads it.

## Toolchain and repository authority

- Blender `5.2.x LTS` is the locked authoring/export line. Phase A0 was
  generated and headlessly verified with Blender `5.2.0 LTS`.
- One Blender metre equals one Claurim metre. Blender source is Z-up; the glTF
  exporter performs the standard conversion to Y-up runtime data.
- Accepted `.blend` files live under `art/blender/` and use Git LFS. Optimized
  `.glb` exports live under `public/assets/models/` as ordinary Git files so
  Pages deployment does not depend on fetching LFS content.
- `art/asset-manifest.json` is the versioned catalog and budget authority.
  Local Blender installations and machine-specific executable paths are never
  committed.

## Identity and transform rules

- Asset IDs use stable lower snake case and are never reused. Root node name,
  manifest ID, and runtime filename must agree.
- The source origin is ground centre. LOD0 must contact runtime Y=0 after
  export and remain within its manifest dimensions/tolerance.
- Rotation and scale are applied to source meshes before export. Placement
  transforms remain content metadata; visual object order never becomes an
  ID or gameplay input.
- Every pilot exports named `LOD0`, `LOD1`, and collider metadata nodes beneath
  one asset root. Custom glTF extras record asset ID, authoring axes, units,
  origin, provenance, LOD role, and collider role.

## Geometry, materials, and textures

- High-poly Blender source is allowed for sculpting and baking; shipped GLBs
  remain game-ready LODs. Detail that does not materially change silhouette is
  baked into normal/AO/material maps instead of entering an unbounded runtime
  mesh.
- Runtime materials use Principled BSDF metal/rough conventions. Procedural
  Blender shaders must be baked before shipping. Unsupported external buffer
  or image references fail validation.
- Pilot LOD0 may use at most two materials; LOD1 may use one. Each GLB may use
  at most four embedded textures and 8 MiB of embedded texture data until A1
  adds KTX2 policy.
- Pilot results and ceilings are:

| Asset | LOD0 | LOD0 ceiling | LOD1 | LOD1 ceiling |
|---|---:|---:|---:|---:|
| Falkmoor tower | 2,360 | 3,000 | 116 | 300 |
| Falkmoor wall | 1,320 | 2,500 | 12 | 100 |
| Falkmoor arch | 792 | 1,400 | 132 | 300 |

## Collision and authority

- A visual mesh never silently becomes gameplay collision. Named collider
  empties describe only an intended simple shape for the later A1/A2 bridge.
- The current TypeScript prop footprints remain authoritative. The Falkmoor
  GLBs are not registered or instantiated by the game in A0.
- Terrain remains the shared pure D-005 height function. Blender terrain
  sculpting is intentionally deferred to the separately locked A4 migration.

## Provenance

- Every manifest record requires author, license, provenance kind, and notes.
  External records additionally require a source URL and a matching
  `THIRD_PARTY_NOTICES.md` entry.
- The Falkmoor pilot geometry and materials are original clean-room work
  generated in Blender by the repository script; they contain no downloaded
  meshes, textures, brands, or franchise material.

## Enforced validation

`npm run validate:assets` parses each GLB rather than trusting filenames. It
rejects invalid or duplicate IDs, path traversal, missing source/export files,
wrong glTF version/generator, external buffers/images, missing roots/LODs/
colliders, mismatched extras, unapplied root scale, triangle/material/texture
budget violations, weak LOD reduction, bad ground contact, wrong dimensions,
and incomplete provenance. `npm run validate` and therefore `npm run gate`
include this asset gate.

The repeatable source script is
`scripts/blender/build_falkmoor_pilot.py`. A passing A0 requires a Blender
5.2.x headless regeneration, the three GLB measurements, focused validator
tests, full repository gate, and visual inspection of
`docs/screenshots/asset_phase_a0_falkmoor_pilot.png`.

Blender may rewrite container metadata when it saves or exports, so byte-for-
byte `.blend`, GLB, and PNG hashes are not an A0 promise. Reproducibility means
the same stable nodes, extras, dimensions, geometry/material/texture metrics,
and validator result from the versioned source script and toolchain.

## Phase boundary

A0 provides editable source, exports, standards, provenance, and rejection.
A1 may add runtime catalogs, caching, KTX2/Meshopt delivery, fallbacks, and hot
reload. A2 may add the no-code Blender import/palette/placement bridge. Neither
phase may weaken this contract without a new lock and equivalent evidence.
