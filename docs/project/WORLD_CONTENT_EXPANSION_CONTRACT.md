# Kaldwyn world-content expansion contract (D-043)

QA Phase K locks the first bounded expansion of Kaldwyn Reach: denser authored
settlements and wilderness, a third enterable natural site, ambient and hostile
wildlife, and the traversal/presentation rules that keep the added volume safe.

## Authored geography

- Kaldwyn remains one exterior simulation space. The expansion adds original
  Claurim locations inside that space rather than copying another game's map,
  names, layout, story, or encounter placement.
- Fenharrow gains three exterior shells. Thornmere Crossing is a second minor
  settlement with five building shells, a well, and three scheduled residents.
- Weeping Stones is an exterior standing-stone and offering-cache landmark.
  Gloamroot Hollow is a five-room enterable wildlife den with an exterior
  entrance, return door, illuminated natural dressing, encounters, and loot.
- All named destinations appear on the D-040 survey map. Doors, schedules,
  spawns, containers, room centers, and the added tour waypoints must resolve
  through the shared D-025/D-037 navigation and placement authority.

## Terrain, forest, and presentation

- Thornmere's authored terrain pad is applied after road shaping and before
  local detail, keeping each building footprint on the shared analytic height.
- Exterior forest sampling uses at least 90 deterministic attempts per terrain
  cell and varied two-layer conifer silhouettes. Trees remain presentation-only
  until a separate tree-collision or resource-system lock is approved.
- Natural interiors are selected by authored space identity (`mine`, `burrow`,
  or `hollow`) and use cavern shell materials. A cave arrival must place the
  third-person camera inside the first room, face progression, and remain
  reachable from the return door.

## Wildlife and residents

- Ridge harts are non-hostile ambient actors with deterministic, bounded local
  wandering. Their wander goal may move only along a complete shared-nav route
  and never changes combat, schedule, or persistence authority.
- Briarboars are hostile standard wildlife; the Gloamroot matriarch is a
  veteran with an authored cone charge and separate loot table.
- Harts and briarboars use distinct articulated quadruped silhouettes. Wildlife
  does not yet provide hunting, taming, breeding, ecology, flight, swimming, or
  burrowing systems.
- Thornmere residents entered Phase K without quest dependencies. D-044 now
  attaches dialogue and two side quests over the existing data runtimes while
  preserving their schedules and D-043 world placement.

## Acceptance

- `tests/world_content_expansion.test.ts` pins original locations, the terrain
  pad, complete Gloamroot routes, cave arrival direction, wildlife hostility and
  wandering bounds, lit silhouettes, and all Thornmere schedules.
- `npm run world:tour` must pass every authored route and placement across all
  five spaces. The generic content validator, originality check, complete gate,
  combat/AI/multiplayer/network benchmarks, and real WebSocket smoke remain
  green.
- Browser QA covers Thornmere, both wildlife archetypes, Weeping Stones,
  Gloamroot's entry/readability, the expanded eight-destination map, both
  supported desktop viewports, and warning/error logs.

## Deliberately separate locks

Additional regions, city-scale streaming, enterable settlement buildings,
weather, tree collision/harvesting, wildlife ecology, mounts, flight/swimming,
radiant spawning, discovery fog, fast travel, and population-scale simulation
remain separate work.
