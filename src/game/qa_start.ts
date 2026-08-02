// Named development-only start points for repeatable browser QA. Production
// builds and online clients never apply them.

import { DT, GAME_HOURS_PER_SECOND, type ContentId, type SpaceId } from '../sim/types';

export interface QaStartPoint {
  spaceId: SpaceId;
  x: number;
  z: number;
  yaw: number;
  hour?: number;
  items?: readonly ContentId[];
  equip?: readonly ContentId[];
  spells?: readonly ContentId[];
}

export const QA_START_POINTS: Readonly<Record<string, QaStartPoint>> = {
  falkmoor: { spaceId: 'kaldwyn', x: 40, z: -410, yaw: 0 },
  loot: { spaceId: 'kaldwyn', x: 44, z: -424, yaw: Math.PI / 2 },
  gear: {
    spaceId: 'kaldwyn', x: 42, z: 158, yaw: Math.PI,
    items: ['iron_sword', 'hunting_bow', 'wooden_shield', 'fur_cuirass', 'fur_hood', 'fur_boots', 'fur_mantle'],
    equip: ['iron_sword', 'wooden_shield', 'fur_cuirass', 'fur_hood', 'fur_boots', 'fur_mantle'],
  },
  rig: { spaceId: 'kaldwyn', x: 0, z: 38, yaw: 0 },
  thornmere: { spaceId: 'kaldwyn', x: -10, z: -180, yaw: 0 },
  'thornmere-wall': { spaceId: 'kaldwyn', x: -8, z: -207, yaw: Math.PI },
  'thornmere-harts': { spaceId: 'kaldwyn', x: 10, z: -220, yaw: Math.PI / 2 },
  'thornmere-tamsin': { spaceId: 'kaldwyn', x: -19.5, z: -176, yaw: -Math.PI / 2 },
  'thornmere-vael': { spaceId: 'kaldwyn', x: -5, z: -202.5, yaw: Math.PI },
  'weeping-stones': { spaceId: 'kaldwyn', x: 80, z: 270, yaw: Math.PI / 2 },
  gloamroot: { spaceId: 'gloamroot_hollow', x: 0, z: 7, yaw: 0 },
  magic: {
    spaceId: 'kaldwyn', x: 42, z: 158, yaw: Math.PI,
    items: [
      'primer_flamebolt', 'primer_frostspike', 'primer_stormneedle',
      'primer_mend_wounds', 'primer_stoneward', 'primer_veilstep',
    ],
  },
  fenharrow: { spaceId: 'kaldwyn', x: 42, z: 158, yaw: Math.PI },
  'fenharrow-door': { spaceId: 'kaldwyn', x: 33, z: 142.5, yaw: 0 },
  inn: { spaceId: 'fenharrow_inn', x: 0, z: 2, yaw: 0 },
  'inn-shift-change': { spaceId: 'fenharrow_inn', x: 0, z: 6, yaw: -Math.PI / 2, hour: 20.99 },
  mine: { spaceId: 'duskhollow_mine', x: 0, z: 2, yaw: 0 },
  siltroot: { spaceId: 'siltroot_burrow', x: 0, z: 2, yaw: 0 },
};

export function qaStartFromSearch(search: string, enabled: boolean): QaStartPoint | null {
  if (!enabled) return null;
  const name = new URLSearchParams(search).get('qa');
  return name ? QA_START_POINTS[name] ?? null : null;
}

export function qaTickForHour(hour: number): number {
  if (!Number.isFinite(hour)) return 0;
  const target = hour < 8 ? hour + 24 : hour;
  return Math.max(0, Math.round(((target - 8) / GAME_HOURS_PER_SECOND) / DT));
}
