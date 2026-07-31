// Deterministic Plan 3 traversal tour. This is the repeatable environment
// acceptance harness: authored exterior routes, both interiors, door targets,
// spawns, schedules, and interaction anchors must all be physically valid.

import { CONTENT, PLAYER_START } from '../sim/content';
import { findPath } from '../sim/navigation/navgrid';
import { CollisionIndex, positionTraversable } from '../sim/world/collision';
import { ROAD_POINTS } from '../sim/world/terrain';

const seedArg = process.argv.find((arg) => arg.startsWith('seed='));
const seed = seedArg ? Number(seedArg.split('=')[1]) : 42;
const colliders = new CollisionIndex(CONTENT);

type Leg = {
  spaceId: string;
  label: string;
  from: { x: number; z: number };
  to: { x: number; z: number };
};

const legs: Leg[] = [
  {
    spaceId: PLAYER_START.spaceId,
    label: 'Falkmoor start to road',
    from: PLAYER_START,
    to: ROAD_POINTS[0],
  },
  ...ROAD_POINTS.slice(0, -1).map((from, index) => ({
    spaceId: 'kaldwyn',
    label: `Kaldwyn road ${index + 1}`,
    from,
    to: ROAD_POINTS[index + 1],
  })),
  {
    spaceId: 'kaldwyn',
    label: 'Fenharrow plaza to inn',
    from: ROAD_POINTS[5],
    to: CONTENT.doors.find((door) => door.id === 'door_inn_in')!,
  },
  {
    spaceId: 'kaldwyn',
    label: 'Mine road to entrance',
    from: ROAD_POINTS[ROAD_POINTS.length - 1],
    to: CONTENT.doors.find((door) => door.id === 'door_mine_in')!,
  },
];

for (const space of Object.values(CONTENT.spaces)) {
  if (space.kind !== 'interior' || !space.interior) continue;
  const inbound = CONTENT.doors.find((door) => door.targetSpaceId === space.id);
  if (!inbound) continue;
  for (const [index, room] of space.interior.rooms.entries()) {
    legs.push({
      spaceId: space.id,
      label: `${space.name} room ${index + 1}`,
      from: { x: inbound.targetX, z: inbound.targetZ },
      to: { x: (room.x0 + room.x1) / 2, z: (room.z0 + room.z1) / 2 },
    });
  }
}

const placements = [
  { label: 'player start', ...PLAYER_START },
  ...CONTENT.doors.flatMap((door) => [
    { label: `door ${door.id}`, spaceId: door.spaceId, x: door.x, z: door.z },
    {
      label: `door target ${door.id}`,
      spaceId: door.targetSpaceId,
      x: door.targetX,
      z: door.targetZ,
    },
  ]),
  ...CONTENT.spawners.map((spawner) => ({ label: `spawner ${spawner.id}`, ...spawner })),
  ...CONTENT.containers.map((container) => ({ label: `container ${container.id}`, ...container })),
  ...Object.values(CONTENT.actors).flatMap((actor) =>
    (actor.schedule ?? []).map((entry, index) => ({
      label: `schedule ${actor.id}[${index}]`,
      ...entry,
    })),
  ),
];

const routeResults = legs.map((leg) => {
  const path = findPath(
    CONTENT,
    colliders,
    leg.spaceId,
    { x: leg.from.x, y: 0, z: leg.from.z },
    leg.to,
    seed,
  );
  let meters = 0;
  if (path) {
    for (let index = 1; index < path.length; index++) {
      meters += Math.hypot(path[index].x - path[index - 1].x, path[index].z - path[index - 1].z);
    }
  }
  return {
    spaceId: leg.spaceId,
    label: leg.label,
    passed: path !== null,
    waypoints: path?.length ?? 0,
    meters: Number(meters.toFixed(1)),
  };
});

const placementResults = placements.map((placement) => ({
  label: placement.label,
  spaceId: placement.spaceId,
  passed: positionTraversable(
    CONTENT,
    colliders,
    placement.spaceId,
    placement.x,
    placement.z,
    seed,
  ),
}));

const coveredSpaces = [...new Set(routeResults.filter((result) => result.passed).map((result) => result.spaceId))].sort();
const passed =
  routeResults.every((result) => result.passed) &&
  placementResults.every((result) => result.passed) &&
  coveredSpaces.length === Object.keys(CONTENT.spaces).length;

console.log(
  JSON.stringify(
    {
      seed,
      passed,
      coveredSpaces,
      authoredSpaces: Object.keys(CONTENT.spaces).sort(),
      routes: routeResults,
      placements: {
        checked: placementResults.length,
        failed: placementResults.filter((result) => !result.passed),
      },
    },
    null,
    2,
  ),
);

if (!passed) process.exitCode = 1;
