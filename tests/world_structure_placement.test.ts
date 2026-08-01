import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/sim/content';
import { buildDoorMarker, buildProp } from '../src/render/structures';
import { terrainHeight } from '../src/sim/world/terrain';

function footprintHeights(
  prop: (typeof CONTENT.props)[number],
  seed: number,
): number[] {
  const yaw = prop.yaw ?? 0;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const samples = [-1, 0, 1];
  return samples.flatMap((u) => samples.map((v) => {
    const localX = u * prop.sx / 2;
    const localZ = v * prop.sz / 2;
    return terrainHeight(
      prop.x + localX * cos + localZ * sin,
      prop.z - localX * sin + localZ * cos,
      seed,
    );
  }));
}

describe('QA Phase E structure placement reproduction', () => {
  it('keeps every Fenharrow structure footprint on one terrain pad', () => {
    const settlement = CONTENT.props.filter((prop) =>
      prop.spaceId === 'kaldwyn'
      && ['inn_shell', 'smithy_shell', 'house_a', 'house_b', 'well', 'forge'].includes(prop.id));

    for (const seed of [42, 1337, 20260730]) {
      for (const prop of settlement) {
        const heights = footprintHeights(prop, seed);
        const spread = Math.max(...heights) - Math.min(...heights);
        expect(spread, `${prop.id} seed ${seed}`).toBeLessThan(0.01);
      }
    }
  });

  it('authors the inn entrance relative to its building facade', () => {
    const inn = CONTENT.props.find((prop) => prop.id === 'inn_shell')!;
    const door = CONTENT.doors.find((candidate) => candidate.id === 'door_inn_in')!;
    expect(door.anchor).toEqual({ propId: inn.id, localX: 0, localZ: -5.5, yawOffset: 0 });

    const yaw = inn.yaw ?? 0;
    const expectedX = inn.x + door.anchor!.localX * Math.cos(yaw) + door.anchor!.localZ * Math.sin(yaw);
    const expectedZ = inn.z - door.anchor!.localX * Math.sin(yaw) + door.anchor!.localZ * Math.cos(yaw);
    expect(door.x).toBeCloseTo(expectedX);
    expect(door.z).toBeCloseTo(expectedZ);
    expect(door.yaw).toBeCloseTo(yaw + door.anchor!.yawOffset);
    expect(buildDoorMarker(door, 'exterior', 42).rotation.y).toBeCloseTo(door.yaw!);
  });

  it('renders a complete grounded well rim instead of an open buried cylinder', () => {
    const well = CONTENT.props.find((prop) => prop.id === 'well')!;
    const mesh = buildProp(well, 'exterior', 42);
    expect(mesh.getObjectByName('well-rim-cap')).toBeDefined();
    expect(mesh.getObjectByName('well-shaft')).toBeDefined();
  });
});
