# World traversal and environmental contract

Plan 3 makes one set of authored geometry rules authoritative for player
movement, AI navigation, projectiles, renderer walls, and third-person camera
obstruction.

## Solid props

- A solid prop uses its authored center, `sx`/`sz`, and `yaw` as an oriented
  rectangular footprint.
- Actor occupancy is a circle-versus-oriented-box test using the shared
  `ACTOR_RADIUS`.
- Projectile and camera segments are transformed into the same prop-local
  coordinates before their entry fraction is calculated.
- When `y` is not authored, a prop's vertical collider begins at the same
  terrain height used by `buildProp`; exterior projectiles therefore hit
  buildings at their rendered elevation.
- The rectangular footprint remains intentionally conservative for cylinders,
  tents, and other non-box procedural meshes.

## Movement and navigation

- `positionTraversable` is the shared actor-occupancy query: region bounds,
  room-union fit, water depth, terrain slope, and solid props.
- Actor movement substeps at no more than 0.2 m and resolves each axis
  separately, so long debug/AI moves cannot tunnel and ordinary movement can
  still slide along a boundary.
- Navigation uses the exact start point, validates its exact goal, and sweeps
  every lattice edge through the shared occupancy query. It may not cut across
  a blocked diagonal or append an unreachable exact endpoint.
- Initial actors, summons, restored characters, and transitions request the
  nearest deterministic traversable point when their desired point is
  obstructed.

## Interiors and camera

- Interior collision is the union of authored room rectangles.
- Rendered room walls are the exact boundary segments of that union. A narrow
  adjoining corridor removes only its opening; it no longer removes the
  remainder of an entire room wall.
- `worldObstructionT` covers oriented solid props, room walls, floors,
  ceilings, and terrain. Projectiles use 0.03 m padding; the third-person
  camera uses 0.22 m clearance and shortens its boom before the hit.
- Space changes snap as before and also clear the moving character's attack,
  block, sprint, velocity, airborne state, dialogue, and shop session. Other
  characters are untouched.

## Water

Swimming is not part of the current milestone. Water depth is
`max(0, WATER_LEVEL - terrainHeight)`. Actors and navigation may wade through
at most `MAX_WADING_DEPTH` (0.5 m); deeper water is a deterministic hard
boundary. Swimming requires its own later locked movement/animation package.

## Authored route gate

`npm run world:tour` checks seed 42 by default:

- Falkmoor start and all seven Kaldwyn road legs;
- the Fenharrow inn, Duskhollow, and Siltroot entrance branches;
- every room in Duskhollow Mine, Siltroot Burrow, and the Fenharrow inn;
- every player start, door/target, spawner anchor, NPC schedule anchor, and
  container placement;
- coverage of every authored space.

`tests/world_traversal.test.ts` additionally pins oriented footprints,
terrain-relative projectile collision, camera obstruction, anti-tunneling,
room-boundary segments, water policy, deterministic spawn placement, and
multiplayer transition/cell isolation.
