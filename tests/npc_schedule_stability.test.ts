import { describe, expect, it } from 'vitest';
import { locomotionMoving } from '../src/render/characters';
import { CONTENT } from '../src/sim/content';
import { findDoorRoute } from '../src/sim/ai/schedules';
import type { ContentRegistry } from '../src/sim/content/schema';
import { findPath } from '../src/sim/navigation/navgrid';
import { IDLE_INPUT, Sim } from '../src/sim/sim';
import { CollisionIndex } from '../src/sim/world/collision';

function disconnectedScheduleContent(): ContentRegistry {
  return {
    ...CONTENT,
    spaces: {
      ...CONTENT.spaces,
      schedule_islands: {
        id: 'schedule_islands',
        name: 'Schedule Islands',
        kind: 'interior',
        interior: {
          ceilingY: 3,
          rooms: [
            { x0: -8, z0: -3, x1: -2, z1: 3 },
            { x0: 2, z0: -3, x1: 8, z1: 3 },
          ],
        },
      },
    },
    actors: {
      ...CONTENT.actors,
      stranded_worker: {
        ...CONTENT.actors.bronn,
        id: 'stranded_worker',
        name: 'Stranded Worker',
        schedule: [
          { fromHour: 0, toHour: 24, spaceId: 'schedule_islands', x: 5, z: 2, activity: 'work' },
        ],
      },
    },
  };
}

describe('QA Phase F unreachable schedule reproduction', () => {
  it('does not slide an NPC against walls when no complete route exists', () => {
    const content = disconnectedScheduleContent();
    const sim = new Sim(42, content, { skipSpawn: true, noDefaultPlayer: true });
    sim.addPlayer('p1', 'Observer');
    sim.movePlayerTo('p1', 'schedule_islands', -6, 0, 0);
    const npcId = sim.spawnFromTemplate('stranded_worker', 'schedule_islands', { x: -5, y: 0, z: -2 }, 0);
    const npc = sim.actors.get(npcId)!;
    const start = { ...npc.pos };

    for (let tick = 0; tick < 30; tick++) sim.tick(IDLE_INPUT);

    expect(Math.hypot(npc.pos.x - start.x, npc.pos.z - start.z)).toBeLessThan(0.01);
    expect(npc.brain!.stuckTicks).toBeGreaterThan(0);

    for (let tick = 0; tick < 40; tick++) sim.tick(IDLE_INPUT);
    expect(npc.brain!.scheduleGoal).toMatchObject({ x: start.x, z: start.z });
    const settled = { ...npc.pos };
    for (let tick = 0; tick < 60; tick++) sim.tick(IDLE_INPUT);
    expect(Math.hypot(npc.pos.x - settled.x, npc.pos.z - settled.z)).toBeLessThan(0.01);
  });

  it('keeps every authored schedule leg connected to its next door or goal', () => {
    const colliders = new CollisionIndex(CONTENT);
    for (const actor of Object.values(CONTENT.actors)) {
      const schedule = actor.schedule ?? [];
      for (let index = 0; index < schedule.length; index++) {
        const from = schedule[index];
        const to = schedule[(index + 1) % schedule.length];
        if (!to) continue;
        const goal = from.spaceId === to.spaceId
          ? to
          : findDoorRoute(CONTENT, from.spaceId, to.spaceId)?.[0];
        expect(goal, `${actor.id} schedule leg ${index} has a door route`).toBeDefined();
        expect(
          findPath(CONTENT, colliders, from.spaceId, { x: from.x, y: 0, z: from.z }, goal!, 42),
          `${actor.id} schedule leg ${index} is reachable`,
        ).not.toBeNull();
      }
    }
  });
});

describe('QA Phase F locomotion dead zone reproduction', () => {
  it('does not turn tiny correction noise into a full walk cycle', () => {
    expect(locomotionMoving(0.001, 1 / 60, false)).toBe(false);
    expect(locomotionMoving(0.05, 1 / 60, false)).toBe(true);
    expect(locomotionMoving(0.001, 1 / 60, true)).toBe(false);
  });
});
