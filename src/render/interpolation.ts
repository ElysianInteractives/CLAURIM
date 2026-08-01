// Host-only transform smoothing. The simulation and network snapshots remain
// authoritative; this module delays presentation by at most one observed tick.

export interface RenderTransform {
  spaceId: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
}

type TransformPair = {
  previous: RenderTransform;
  current: RenderTransform;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(1, value));
}

function sameTransform(a: RenderTransform, b: RenderTransform): boolean {
  return a.spaceId === b.spaceId && a.x === b.x && a.y === b.y && a.z === b.z && a.yaw === b.yaw;
}

function copyTransform(value: RenderTransform): RenderTransform {
  return { ...value };
}

export function interpolateYaw(from: number, to: number, alpha: number): number {
  const delta = ((to - from + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return from + delta * clamp01(alpha);
}

export class TransformHistory {
  private readonly history = new Map<number, TransformPair>();

  constructor(private readonly snapDistance = 4) {}

  sample(id: number, observed: RenderTransform, alpha: number): RenderTransform {
    let pair = this.history.get(id);
    if (!pair) {
      const initial = copyTransform(observed);
      pair = { previous: initial, current: copyTransform(observed) };
      this.history.set(id, pair);
      return copyTransform(observed);
    }

    if (!sameTransform(pair.current, observed)) {
      const distance = Math.hypot(
        observed.x - pair.current.x,
        observed.y - pair.current.y,
        observed.z - pair.current.z,
      );
      if (observed.spaceId !== pair.current.spaceId || distance > this.snapDistance) {
        pair.previous = copyTransform(observed);
        pair.current = copyTransform(observed);
      } else {
        pair.previous = copyTransform(pair.current);
        pair.current = copyTransform(observed);
      }
    }

    const t = clamp01(alpha);
    return {
      spaceId: pair.current.spaceId,
      x: pair.previous.x + (pair.current.x - pair.previous.x) * t,
      y: pair.previous.y + (pair.current.y - pair.previous.y) * t,
      z: pair.previous.z + (pair.current.z - pair.previous.z) * t,
      yaw: interpolateYaw(pair.previous.yaw, pair.current.yaw, t),
    };
  }

  retain(ids: ReadonlySet<number>): void {
    for (const id of this.history.keys()) {
      if (!ids.has(id)) this.history.delete(id);
    }
  }

  clear(): void {
    this.history.clear();
  }
}
