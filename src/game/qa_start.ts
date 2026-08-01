// Named development-only start points for repeatable browser QA. Production
// builds and online clients never apply them.

import type { SpaceId } from '../sim/types';

export interface QaStartPoint {
  spaceId: SpaceId;
  x: number;
  z: number;
  yaw: number;
}

export const QA_START_POINTS: Readonly<Record<string, QaStartPoint>> = {
  falkmoor: { spaceId: 'kaldwyn', x: 40, z: -410, yaw: 0 },
  fenharrow: { spaceId: 'kaldwyn', x: 42, z: 158, yaw: Math.PI },
  'fenharrow-door': { spaceId: 'kaldwyn', x: 33, z: 142.5, yaw: 0 },
  inn: { spaceId: 'fenharrow_inn', x: 0, z: 2, yaw: 0 },
  mine: { spaceId: 'duskhollow_mine', x: 0, z: 2, yaw: 0 },
  siltroot: { spaceId: 'siltroot_burrow', x: 0, z: 2, yaw: 0 },
};

export function qaStartFromSearch(search: string, enabled: boolean): QaStartPoint | null {
  if (!enabled) return null;
  const name = new URLSearchParams(search).get('qa');
  return name ? QA_START_POINTS[name] ?? null : null;
}
