import { describe, expect, it } from 'vitest';
import { AdaptivePixelRatio } from '../src/render/frame_pacing';

describe('QA frame-pacing protection', () => {
  it('reduces raster load only after sustained slow frames', () => {
    const controller = new AdaptivePixelRatio(2, 1);
    const changes: number[] = [];
    for (let frame = 0; frame < 180; frame++) {
      const changed = controller.observe(1 / 30);
      if (changed !== null) changes.push(changed);
    }
    expect(changes[0]).toBe(1.75);
    expect(controller.current()).toBeLessThanOrEqual(1.25);
  });

  it('recovers quality slowly after sustained fast frames', () => {
    const controller = new AdaptivePixelRatio(2, 1, 1);
    for (let frame = 0; frame < 720; frame++) controller.observe(1 / 120);
    expect(controller.current()).toBeGreaterThan(1);
    expect(controller.current()).toBeLessThanOrEqual(1.5);
  });

  it('ignores background-sized timing gaps', () => {
    const controller = new AdaptivePixelRatio(2, 1);
    for (let frame = 0; frame < 20; frame++) controller.observe(0.5);
    expect(controller.current()).toBe(2);
  });

  it('can protect a one-to-one display when sustained load still misses frame pacing', () => {
    const controller = new AdaptivePixelRatio(1);
    for (let frame = 0; frame < 120; frame++) controller.observe(1 / 30);
    expect(controller.current()).toBe(0.75);
  });
});
