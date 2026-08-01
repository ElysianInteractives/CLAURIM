// Schedule and door-graph helpers. Active NPCs follow each authored door in
// sequence; inactive NPCs may collapse the same valid route to its destination
// anchor so schedules advance without simulating an unobserved commute.

import type { Actor } from '../types';
import type {
  ContentRegistry,
  DoorDef,
  ScheduleEntry,
} from '../content/schema';

export function currentScheduleEntry(
  content: ContentRegistry,
  actor: Actor,
  gameHours: number,
): ScheduleEntry | null {
  const schedule = content.actors[actor.templateId]?.schedule;
  if (!schedule || schedule.length === 0) return null;
  const hour = ((gameHours % 24) + 24) % 24;
  return (
    schedule.find((entry) =>
      entry.fromHour <= entry.toHour
        ? hour >= entry.fromHour && hour < entry.toHour
        : hour >= entry.fromHour || hour < entry.toHour,
    ) ?? schedule[0]
  );
}

/** Breadth-first, content-order-stable route through directed doors. */
export function findDoorRoute(
  content: ContentRegistry,
  fromSpaceId: string,
  targetSpaceId: string,
): DoorDef[] | null {
  if (fromSpaceId === targetSpaceId) return [];
  const queue: Array<{ spaceId: string; route: DoorDef[] }> = [
    { spaceId: fromSpaceId, route: [] },
  ];
  const visited = new Set<string>([fromSpaceId]);
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const door of content.doors) {
      if (door.spaceId !== current.spaceId || visited.has(door.targetSpaceId)) continue;
      const route = [...current.route, door];
      if (door.targetSpaceId === targetSpaceId) return route;
      visited.add(door.targetSpaceId);
      queue.push({ spaceId: door.targetSpaceId, route });
    }
  }
  return null;
}
