import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/sim/content';
import { CollisionIndex, worldObstructionT } from '../src/sim/world/collision';
import { groundHeight } from '../src/sim/world/spaces';
import {
  CameraBoomSmoother,
  thirdPersonCameraPose,
  unobstructedBoomScale,
} from '../src/render/camera';
import { TransformHistory } from '../src/render/interpolation';

describe('QA camera-wide jitter reproduction', () => {
  it('turns Fenharrow collider release into continuous frame motion', () => {
    const colliders = new CollisionIndex(CONTENT);
    const smoother = new CameraBoomSmoother();
    const seed = 20260730;
    let previousRaw: { x: number; y: number; z: number } | null = null;
    let previousStable: { x: number; y: number; z: number } | null = null;
    let maximumRawStep = 0;
    let maximumStableStep = 0;

    for (let frame = 0; frame < 90; frame++) {
      const x = 42;
      const z = 158 + frame * 4.4 / 60;
      const eye = { x, y: groundHeight(CONTENT, 'kaldwyn', x, z, seed) + 1.62, z };
      const desired = thirdPersonCameraPose(eye, 0, -0.25, 6);
      const obstruction = worldObstructionT(
        CONTENT,
        colliders,
        'kaldwyn',
        eye,
        desired.position,
        seed,
        0.22,
      );
      const desiredLength = Math.hypot(
        desired.position.x - eye.x,
        desired.position.y - eye.y,
        desired.position.z - eye.z,
      );
      const rawScale = unobstructedBoomScale(obstruction, desiredLength);
      const stableScale = smoother.update(rawScale, desiredLength, 1 / 60);
      const raw = thirdPersonCameraPose(eye, 0, -0.25, 6, rawScale).position;
      const stable = thirdPersonCameraPose(eye, 0, -0.25, 6, stableScale).position;
      if (previousRaw && previousStable) {
        maximumRawStep = Math.max(maximumRawStep, Math.hypot(
          raw.x - previousRaw.x,
          raw.y - previousRaw.y,
          raw.z - previousRaw.z,
        ));
        maximumStableStep = Math.max(maximumStableStep, Math.hypot(
          stable.x - previousStable.x,
          stable.y - previousStable.y,
          stable.z - previousStable.z,
        ));
      }
      previousRaw = raw;
      previousStable = stable;
    }

    expect(maximumRawStep).toBeGreaterThan(5);
    expect(maximumStableStep).toBeLessThan(0.1);
  });

  it('keeps the camera anchor fixed after collision produces an unchanged tick', () => {
    const history = new TransformHistory();
    const at = (z: number) => ({ spaceId: 'kaldwyn', x: 42, y: 1.62, z, yaw: 0 });
    history.observe(1, at(158));
    history.observe(1, at(158.1));
    history.observe(1, at(158.1));

    const positions = [0, 0.25, 0.5, 0.75, 1].map((alpha) => {
      const eye = history.sample(1, at(158.1), alpha);
      return thirdPersonCameraPose(eye, 0, -0.25, 6).position;
    });
    for (const position of positions.slice(1)) {
      expect(position.x).toBeCloseTo(positions[0].x);
      expect(position.y).toBeCloseTo(positions[0].y);
      expect(position.z).toBeCloseTo(positions[0].z);
    }
  });
});
