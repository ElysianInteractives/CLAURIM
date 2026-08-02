// Pure third-person camera geometry. The renderer owns obstruction queries,
// while this module keeps composition and the authoritative reticle direction
// independently testable.

import type { Vec3 } from '../sim/types';
import { reticleDirection } from '../sim/player/aim';

export const THIRD_PERSON_SHOULDER_OFFSET = 0.9;
export const THIRD_PERSON_BODY_HIDE_DISTANCE = 1.1;
export const CAMERA_RELEASE_HOLD_SECONDS = 0.06;
export const CAMERA_RELEASE_MAX_METERS_PER_SECOND = 5;

/**
 * Stabilizes collision recovery without ever allowing a newly blocked camera
 * to remain outside its safe boom. Inward motion is immediate; release waits
 * for a stable clear result and then expands at a bounded, frame-rate-neutral
 * speed. This prevents collider-edge flicker from moving the whole world.
 */
export class CameraBoomSmoother {
  private current: number | null = null;
  private releaseStableSeconds = 0;

  update(targetScale: number, desiredLength: number, dtSec: number): number {
    const target = Number.isFinite(targetScale) ? Math.max(0, Math.min(1, targetScale)) : 0;
    const length = Number.isFinite(desiredLength) ? Math.max(0.001, desiredLength) : 0.001;
    const dt = Number.isFinite(dtSec) ? Math.max(0, Math.min(0.1, dtSec)) : 0;
    if (this.current === null) {
      this.current = target;
      return target;
    }
    if (target <= this.current) {
      this.current = target;
      this.releaseStableSeconds = 0;
      return target;
    }

    this.releaseStableSeconds += dt;
    if (this.releaseStableSeconds < CAMERA_RELEASE_HOLD_SECONDS) return this.current;
    const exponentialStep = (target - this.current) * (1 - Math.exp(-8 * dt));
    const speedStep = (CAMERA_RELEASE_MAX_METERS_PER_SECOND * dt) / length;
    this.current = Math.min(target, this.current + Math.min(exponentialStep, speedStep));
    return this.current;
  }

  reset(): void {
    this.current = null;
    this.releaseStableSeconds = 0;
  }
}

export interface ThirdPersonCameraPose {
  position: Vec3;
  forward: Vec3;
  screenRight: Vec3;
  boomScale: number;
  bodyVisible: boolean;
}

/** Build a right-shoulder camera pose whose center ray remains parallel to
 * the authoritative reticle/projectile direction. `boomScale` compresses
 * both the trailing distance and shoulder offset when geometry intervenes. */
export function thirdPersonCameraPose(
  eye: Vec3,
  yaw: number,
  pitch: number,
  distance: number,
  boomScale = 1,
): ThirdPersonCameraPose {
  const scale = Number.isFinite(boomScale) ? Math.max(0, Math.min(1, boomScale)) : 1;
  const boundedDistance = Number.isFinite(distance) ? Math.max(0, distance) : 0;
  const forward = reticleDirection(yaw, pitch);
  // Camera-local right for a +Z-facing actor is world -X. This matches the
  // camera-relative movement basis and places the player left of the reticle.
  const screenRight = { x: -Math.cos(yaw), y: 0, z: Math.sin(yaw) };
  const trailing = boundedDistance * scale;
  const shoulder = THIRD_PERSON_SHOULDER_OFFSET * scale;
  return {
    position: {
      x: eye.x - forward.x * trailing + screenRight.x * shoulder,
      y: eye.y - forward.y * trailing,
      z: eye.z - forward.z * trailing + screenRight.z * shoulder,
    },
    forward,
    screenRight,
    boomScale: scale,
    bodyVisible: trailing >= THIRD_PERSON_BODY_HIDE_DISTANCE,
  };
}

/** Convert the earliest obstruction fraction into a clearance-backed scale
 * along the diagonal shoulder boom. */
export function unobstructedBoomScale(
  obstructionT: number | null,
  desiredLength: number,
  clearance = 0.2,
): number {
  if (obstructionT === null) return 1;
  if (!Number.isFinite(desiredLength) || desiredLength <= 0) return 0;
  const boundedHit = Number.isFinite(obstructionT) ? Math.max(0, Math.min(1, obstructionT)) : 0;
  return Math.max(0, Math.min(1, boundedHit - Math.max(0, clearance) / desiredLength));
}
