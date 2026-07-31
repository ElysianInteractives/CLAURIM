import { describe, expect, it } from 'vitest';
import { runNetworkProfile } from '../src/headless/network_bench';
import {
  ImpairmentPolicy,
  NETWORK_PROFILES,
} from '../src/net/impairment';

describe('deterministic ordered impairment policy', () => {
  it('repeats from the same seed and never reorders WebSocket frames', () => {
    const profile = NETWORK_PROFILES.find((candidate) => candidate.name === 'severe')!;
    const run = (): ReturnType<ImpairmentPolicy['plan']>[] => {
      const policy = new ImpairmentPolicy(profile, 12345);
      return Array.from({ length: 40 }, (_, index) => policy.plan(index * 3, true));
    };
    const first = run();
    expect(first).toEqual(run());
    const delivered = first.filter((plan) => !plan.dropped);
    for (let index = 1; index < delivered.length; index++) {
      expect(delivered[index].deliveryAtMs).toBeGreaterThan(delivered[index - 1].deliveryAtMs);
    }
  });
});

describe.each(NETWORK_PROFILES)('$name network acceptance', (profile) => {
  it('joins, reconciles, and keeps remote motion observable', () => {
    const result = runNetworkProfile(profile);
    expect(result.connected).toBe(true);
    expect(result.disconnects).toBe(0);
    expect(result.inputToAuthorityP95Ms).toBeGreaterThan(0);
    expect(result.snapshotBytesPerSecond).toBeGreaterThan(1_000);
    expect(result.authoritativeMotionMeters).toBeGreaterThan(1);
    expect(result.remoteMotionMeters).toBeGreaterThan(1);
    expect(result.pendingInputsAtEnd).toBe(0);
    expect(Number.isFinite(result.maxCorrectionMeters)).toBe(true);
    expect(result.maxCorrectionMeters).toBeLessThan(3.5);
    if (profile.qualityTarget) {
      expect(result.inputToAuthorityP95Ms).toBeLessThan(650);
      expect(result.maxCorrectionMeters).toBeLessThan(2.5);
    }
  });
});
