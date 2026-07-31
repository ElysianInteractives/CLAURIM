// Deterministic WebSocket-message impairment policy used by the headless
// matrix and the development relay. Control/handshake frames can be marked
// reliable while transient input/snapshot frames exercise loss recovery.

import { Rng } from '../sim/rng';

export type NetworkProfileName = 'local' | 'good' | 'degraded' | 'severe';

export interface NetworkProfile {
  name: NetworkProfileName;
  rttMs: number;
  jitterMs: number;
  loss: number;
  qualityTarget: boolean;
}

export const NETWORK_PROFILES: readonly NetworkProfile[] = [
  { name: 'local', rttMs: 2, jitterMs: 0, loss: 0, qualityTarget: true },
  { name: 'good', rttMs: 80, jitterMs: 10, loss: 0, qualityTarget: true },
  { name: 'degraded', rttMs: 150, jitterMs: 30, loss: 0.01, qualityTarget: true },
  { name: 'severe', rttMs: 250, jitterMs: 50, loss: 0.03, qualityTarget: false },
] as const;

export interface ImpairmentPlan {
  dropped: boolean;
  deliveryAtMs: number;
  delayMs: number;
}

/**
 * Plans one direction of an ordered WebSocket stream. Jitter changes delivery
 * time but never reorders frames, matching WebSocket/TCP ordering. "Loss" is
 * intentionally applied only when the caller marks an ephemeral frame
 * droppable; protocol control and discrete gameplay commands remain reliable.
 */
export class ImpairmentPolicy {
  private readonly rng: Rng;
  private deliveryTailMs = -Infinity;

  constructor(
    readonly profile: NetworkProfile,
    seed: number,
  ) {
    this.rng = new Rng(seed);
  }

  plan(nowMs: number, droppable: boolean): ImpairmentPlan {
    if (droppable && this.rng.chance(this.profile.loss)) {
      return { dropped: true, deliveryAtMs: nowMs, delayMs: 0 };
    }
    const oneWayMs = this.profile.rttMs / 2;
    const jitter = this.profile.jitterMs === 0 ? 0 : this.rng.range(-this.profile.jitterMs / 2, this.profile.jitterMs / 2);
    const requestedAt = nowMs + Math.max(0, oneWayMs + jitter);
    const deliveryAtMs = Math.max(requestedAt, this.deliveryTailMs + 0.001);
    this.deliveryTailMs = deliveryAtMs;
    return {
      dropped: false,
      deliveryAtMs,
      delayMs: deliveryAtMs - nowMs,
    };
  }
}

export function networkProfile(name: string): NetworkProfile {
  const profile = NETWORK_PROFILES.find((candidate) => candidate.name === name.toLowerCase());
  if (!profile) throw new Error(`unknown network profile "${name}"`);
  return profile;
}
