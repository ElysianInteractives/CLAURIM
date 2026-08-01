// Pure player-movement rules shared by the authoritative sim and online
// prediction. This module owns no state and performs no collision queries.

import { DT, SPRINT_STAMINA_PER_SEC } from '../types';

/** Exhausted players must recover this fraction before sprint can restart. */
export const SPRINT_RESTART_FRACTION = 0.1;

export interface SprintDecision {
  /** Sprint speed applies to this movement tick. */
  applied: boolean;
  /** Sprint remains active after this tick's stamina cost. */
  active: boolean;
  stamina: number;
}

/** Convert camera-local axes into world motion. The Three.js camera faces
 * local -Z, so its screen-right vector is (-cos(yaw), sin(yaw)). */
export function localMovementToWorld(
  moveX: number,
  moveZ: number,
  yaw: number,
): { x: number; z: number; moving: boolean } {
  const length = Math.hypot(moveX, moveZ);
  if (length <= 0.01) return { x: 0, z: 0, moving: false };
  const localX = moveX / Math.max(1, length);
  const localZ = moveZ / Math.max(1, length);
  return {
    x: -localX * Math.cos(yaw) + localZ * Math.sin(yaw),
    z: localX * Math.sin(yaw) + localZ * Math.cos(yaw),
    moving: true,
  };
}

/** Decide and charge one tick of sprint. `wasSprinting` distinguishes a
 * continuing sprint from an exhausted player waiting for the restart floor. */
export function advanceSprint(
  requested: boolean,
  sneaking: boolean,
  moving: boolean,
  wasSprinting: boolean,
  stamina: number,
  maxStamina: number,
): SprintDecision {
  const boundedStamina = Math.max(0, Math.min(maxStamina, stamina));
  const restartAt = Math.max(SPRINT_STAMINA_PER_SEC * DT, maxStamina * SPRINT_RESTART_FRACTION);
  const hasStamina = wasSprinting ? boundedStamina > 0 : boundedStamina >= restartAt;
  const applied = requested && !sneaking && moving && hasStamina;
  if (!applied) return { applied: false, active: false, stamina: boundedStamina };

  const remaining = Math.max(0, boundedStamina - SPRINT_STAMINA_PER_SEC * DT);
  return { applied: true, active: remaining > 0, stamina: remaining };
}

/** Match the sim's post-movement stamina regeneration. */
export function regenerateStamina(
  stamina: number,
  maxStamina: number,
  staminaRegen: number,
  sprinting: boolean,
): number {
  if (sprinting) return stamina;
  return Math.min(maxStamina, stamina + Math.max(0, staminaRegen) * DT);
}
