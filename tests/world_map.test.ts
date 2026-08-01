import { describe, expect, it } from 'vitest';
import {
  mapDefinition,
  navigationCue,
  renderNavigationCue,
  renderWorldMap,
} from '../src/ui/world_map';

describe('QA Phase H world-map and navigation reproduction', () => {
  it('maps the exterior road and every authored destination landmark', () => {
    const map = mapDefinition('kaldwyn');
    expect(map.kind).toBe('exterior');
    expect(map.road.length).toBeGreaterThanOrEqual(8);
    expect(map.landmarks.map((landmark) => landmark.id)).toEqual(expect.arrayContaining([
      'falkmoor',
      'road-camp',
      'fenharrow',
      'siltroot',
      'duskhollow',
    ]));
  });

  it('renders authored interior rooms without leaking exterior landmarks', () => {
    const map = mapDefinition('duskhollow_mine');
    expect(map.kind).toBe('interior');
    expect(map.rooms).toHaveLength(5);
    expect(map.landmarks.some((landmark) => landmark.id === 'falkmoor')).toBe(false);

    const html = renderWorldMap(map, { x: 0, z: 32, yaw: 0 }, null);
    expect(html).toContain('aria-label="Duskhollow Mine map"');
    expect(html.match(/class="map-room"/g)).toHaveLength(5);
    expect(html).toContain('data-map-player');
  });

  it('computes an accurate relative bearing and distance from player heading', () => {
    expect(navigationCue(
      { x: 0, z: 0, yaw: 0 },
      { id: 'north', name: 'North', spaceId: 'kaldwyn', x: 0, z: 100 },
    )).toMatchObject({ distance: 100, relativeBearing: 0, direction: 'ahead' });
    expect(navigationCue(
      { x: 0, z: 0, yaw: 0 },
      { id: 'east', name: 'East', spaceId: 'kaldwyn', x: 50, z: 0 },
    )).toMatchObject({ distance: 50, direction: 'right' });
  });

  it('renders selectable landmarks, selected state, and a navigation readout', () => {
    const map = mapDefinition('kaldwyn');
    const fenharrow = map.landmarks.find((landmark) => landmark.id === 'fenharrow')!;
    const html = renderWorldMap(map, { x: 40, z: -416, yaw: 0 }, fenharrow);
    expect(html).toContain('aria-label="Kaldwyn Reach map"');
    expect(html).toContain('data-act="map-waypoint"');
    expect(html).toContain('aria-pressed="true"');
    expect(renderNavigationCue({ x: 40, z: -416, yaw: 0 }, fenharrow)).toContain('Fenharrow');
  });
});
