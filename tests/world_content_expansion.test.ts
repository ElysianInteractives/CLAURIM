import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/sim/content';
import { Sim, IDLE_INPUT } from '../src/sim/sim';
import { CROSSING_CENTER, CROSSING_PLATEAU_H, terrainHeight } from '../src/sim/world/terrain';
import { findPath } from '../src/sim/navigation/navgrid';
import { buildCharacter } from '../src/render/characters';
import { buildProp } from '../src/render/structures';
import { TREE_TRIES_PER_CELL } from '../src/render/terrain_mesh';

describe('QA Phase K original world and wildlife expansion', () => {
  it('adds a second settlement, original landmark, and third enterable wildlife site', () => {
    expect(Object.keys(CONTENT.spaces)).toContain('gloamroot_hollow');
    expect(CONTENT.props.filter((prop) => prop.id.startsWith('thornmere_'))).toHaveLength(6);
    expect(CONTENT.props.filter((prop) => prop.id.startsWith('weeping_'))).toHaveLength(4);
    const entrance = CONTENT.doors.find((door) => door.targetSpaceId === 'gloamroot_hollow');
    expect(entrance?.targetZ).toBeGreaterThanOrEqual(7);
    expect(entrance?.targetYaw).toBe(0);
    expect(CONTENT.containers.some((container) => container.id === 'weeping_offering')).toBe(true);
    expect(TREE_TRIES_PER_CELL).toBeGreaterThanOrEqual(90);
  });

  it('keeps every Thornmere building footprint on its authored terrain pad', () => {
    const buildings = CONTENT.props.filter((prop) => prop.id.startsWith('thornmere_') && prop.kind.startsWith('building'));
    expect(buildings.length).toBeGreaterThanOrEqual(5);
    for (const prop of buildings) {
      const yaw = prop.yaw ?? 0;
      for (const [lx, lz] of [[0, 0], [-prop.sx / 2, -prop.sz / 2], [prop.sx / 2, prop.sz / 2]] as const) {
        const x = prop.x + lx * Math.cos(yaw) + lz * Math.sin(yaw);
        const z = prop.z - lx * Math.sin(yaw) + lz * Math.cos(yaw);
        expect(terrainHeight(x, z, 42), `${prop.id} at ${x},${z}`).toBeCloseTo(CROSSING_PLATEAU_H, 5);
        expect(Math.hypot(x - CROSSING_CENTER.x, z - CROSSING_CENTER.z)).toBeLessThan(55);
      }
    }
  });

  it('routes through every room of Gloamroot and reaches its cache and exit', () => {
    const layout = CONTENT.spaces.gloamroot_hollow.interior!;
    const entrance = CONTENT.doors.find((door) => door.id === 'door_gloamroot_in')!;
    const goals = [
      ...layout.rooms.map((room) => ({ x: (room.x0 + room.x1) / 2, z: (room.z0 + room.z1) / 2 })),
      CONTENT.containers.find((container) => container.id === 'gloamroot_cache')!,
      CONTENT.doors.find((door) => door.id === 'door_gloamroot_out')!,
    ];
    const sim = new Sim(42);
    for (const goal of goals) {
      expect(findPath(
        CONTENT,
        sim.colliders,
        'gloamroot_hollow',
        { x: entrance.targetX, y: 0, z: entrance.targetZ },
        goal,
        42,
      ), `${goal.x},${goal.z}`).not.toBeNull();
    }
  });

  it('distinguishes ambient harts from hostile briarboars and lets harts roam locally', () => {
    expect(CONTENT.actors.ridge_hart.aggressive).toBe(false);
    expect(CONTENT.actors.ridge_hart.ambientWanderRadius).toBe(10);
    expect(CONTENT.actors.briarboar.aggressive).toBe(true);
    expect(CONTENT.actors.briarboar_matriarch.tier).toBe('veteran');

    const sim = new Sim(42);
    sim.movePlayerTo('p1', 'kaldwyn', -10, -180, 0);
    const hart = [...sim.actors.values()].find((actor) => actor.templateId === 'ridge_hart')!;
    const start = { ...hart.pos };
    for (let tick = 0; tick < 300; tick++) sim.tick(IDLE_INPUT);
    expect(Math.hypot(hart.pos.x - start.x, hart.pos.z - start.z)).toBeGreaterThan(0.5);
    expect(Math.hypot(hart.pos.x - hart.brain!.homePos.x, hart.pos.z - hart.brain!.homePos.z)).toBeLessThanOrEqual(13);
  });

  it('renders distinct wildlife, landmark, root, and illuminated glowcap silhouettes', () => {
    const hart = buildCharacter('hart');
    const boar = buildCharacter('boar');
    expect(hart.getObjectByName('antlerL')).toBeTruthy();
    expect(boar.getObjectByName('tuskR')).toBeTruthy();
    const standingStone = buildProp(CONTENT.props.find((prop) => prop.id === 'weeping_stone_a')!, 'exterior', 42);
    const root = buildProp(CONTENT.props.find((prop) => prop.id === 'gloamroot_root_a')!, 'interior', 42);
    const glowcaps = buildProp(CONTENT.props.find((prop) => prop.id === 'gloamroot_caps_entry')!, 'interior', 42);
    expect(standingStone.children.length).toBeGreaterThan(0);
    expect(root.children.length).toBeGreaterThan(0);
    expect(glowcaps.children.some((child) => child.type === 'PointLight')).toBe(true);
  });

  it('adds three scheduled non-quest residents to Thornmere', () => {
    for (const id of ['tamsin', 'corren', 'vael']) {
      const actor = CONTENT.actors[id];
      expect(actor.kind, id).toBe('npc');
      expect(actor.dialogueId, id).toBeUndefined();
      expect(actor.schedule?.length, id).toBeGreaterThanOrEqual(3);
      expect(actor.schedule?.every((entry) => entry.spaceId === 'kaldwyn'), id).toBe(true);
    }
  });
});
