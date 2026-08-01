// Pure reticle-aim rules shared by player input, the authoritative combat
// simulation, online input validation, and read-only target presentation.

import type { Vec3 } from '../types';

export const MIN_AIM_PITCH = -1.35;
export const MAX_AIM_PITCH = 1.1;

export function clampAimPitch(pitch: number): number {
  if (!Number.isFinite(pitch)) return 0;
  return Math.max(MIN_AIM_PITCH, Math.min(MAX_AIM_PITCH, pitch));
}

/** Unit vector through the center reticle. Yaw zero points toward world +Z;
 * positive pitch points upward. */
export function reticleDirection(yaw: number, pitch: number): Vec3 {
  const boundedPitch = clampAimPitch(pitch);
  const horizontal = Math.cos(boundedPitch);
  return {
    x: Math.sin(yaw) * horizontal,
    y: Math.sin(boundedPitch),
    z: Math.cos(yaw) * horizontal,
  };
}
