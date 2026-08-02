import { describe, expect, it } from 'vitest';
import {
  FIRST_PERSON_EYE_HEIGHT,
  FIRST_PERSON_FACE_OFFSET,
  CAMERA_RELEASE_MAX_METERS_PER_SECOND,
  CameraBoomSmoother,
  firstPersonCameraPose,
  THIRD_PERSON_SHOULDER_OFFSET,
  thirdPersonCameraPose,
  unobstructedBoomScale,
} from '../src/render/camera';
import { reticleDirection } from '../src/sim/player/aim';

describe('QA Phase D third-person reticle visibility reproduction', () => {
  it('places the first-person lens at the face while retaining the reticle ray', () => {
    const feet = { x: 4, y: 2, z: -3 };
    const yaw = Math.PI / 2;
    const pitch = 0.35;
    const pose = firstPersonCameraPose(feet, yaw, pitch);
    expect(pose.position.x).toBeCloseTo(feet.x + FIRST_PERSON_FACE_OFFSET);
    expect(pose.position.y).toBeCloseTo(feet.y + FIRST_PERSON_EYE_HEIGHT);
    expect(pose.position.z).toBeCloseTo(feet.z);
    expect(pose.forward).toEqual(reticleDirection(yaw, pitch));
  });
  it('keeps the player model off the center reticle while preserving aim direction', () => {
    const eye = { x: 12, y: 4.2, z: -7 };
    const yaw = 0.73;
    const pitch = 0.31;
    const pose = thirdPersonCameraPose(eye, yaw, pitch, 6);
    const expectedForward = reticleDirection(yaw, pitch);

    expect(pose.forward.x).toBeCloseTo(expectedForward.x);
    expect(pose.forward.y).toBeCloseTo(expectedForward.y);
    expect(pose.forward.z).toBeCloseTo(expectedForward.z);

    const cameraToEye = {
      x: eye.x - pose.position.x,
      y: eye.y - pose.position.y,
      z: eye.z - pose.position.z,
    };
    const eyeOffsetFromReticle = Math.abs(
      cameraToEye.x * pose.screenRight.x
      + cameraToEye.y * pose.screenRight.y
      + cameraToEye.z * pose.screenRight.z,
    );
    expect(eyeOffsetFromReticle).toBeCloseTo(THIRD_PERSON_SHOULDER_OFFSET);
    expect(eyeOffsetFromReticle).toBeGreaterThan(0.7);
  });

  it('compresses the whole shoulder boom without changing the center ray', () => {
    const eye = { x: 0, y: 1.62, z: 0 };
    const full = thirdPersonCameraPose(eye, 0, -0.25, 6);
    const compressed = thirdPersonCameraPose(eye, 0, -0.25, 6, 0.4);

    expect(compressed.forward).toEqual(full.forward);
    expect(compressed.position.x - eye.x).toBeCloseTo((full.position.x - eye.x) * 0.4);
    expect(compressed.position.y - eye.y).toBeCloseTo((full.position.y - eye.y) * 0.4);
    expect(compressed.position.z - eye.z).toBeCloseTo((full.position.z - eye.z) * 0.4);
  });

  it('backs away from obstruction clearance and hides the body only at extreme compression', () => {
    expect(unobstructedBoomScale(null, 6)).toBe(1);
    expect(unobstructedBoomScale(0.5, 6, 0.2)).toBeCloseTo(0.5 - 0.2 / 6);
    expect(thirdPersonCameraPose({ x: 0, y: 1.62, z: 0 }, 0, 0, 6, 0.4).bodyVisible).toBe(true);
    expect(thirdPersonCameraPose({ x: 0, y: 1.62, z: 0 }, 0, 0, 6, 0.1).bodyVisible).toBe(false);
  });

  it('releases a cleared camera gradually and re-enters obstruction immediately', () => {
    const smoother = new CameraBoomSmoother();
    const frame = 1 / 60;
    expect(smoother.update(0.05, 6, frame)).toBe(0.05);

    // A collider edge changing from blocked to clear cannot move the camera
    // several metres in one rendered frame.
    for (let index = 0; index < 4; index++) smoother.update(1, 6, frame);
    const released = smoother.update(1, 6, frame);
    expect((released - 0.05) * 6).toBeLessThanOrEqual(CAMERA_RELEASE_MAX_METERS_PER_SECOND * frame * 2);
    expect(released).toBeLessThan(0.2);

    expect(smoother.update(0.03, 6, frame)).toBe(0.03);
  });

  it('does not chase an alternating clear signal at a collider edge', () => {
    const smoother = new CameraBoomSmoother();
    const frame = 1 / 60;
    smoother.update(0.08, 6, frame);
    for (let index = 0; index < 12; index++) {
      smoother.update(index % 2 === 0 ? 1 : 0.08, 6, frame);
    }
    expect(smoother.update(0.08, 6, frame)).toBeCloseTo(0.08);
  });
});
