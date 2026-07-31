// Deterministic seeded RNG. ALL simulation randomness flows through an Rng
// instance owned by the Sim (or through the stateless coordinate hashes below).
// Never Math.random, Date.now, or performance.now in sim code: the architecture
// guard test (tests/architecture.test.ts) scans for violations.
//
// Algorithm: splitmix32-style mixer. Public-domain construction; original
// implementation for Claurim.

export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
    if (this.s === 0) this.s = 0x1b873593;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.s = (this.s + 0x9e3779b9) >>> 0;
    let z = this.s;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
    z = z ^ (z >>> 15);
    return (z >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Integer in [min, max], inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Serializable internal state, for save round-trips. */
  getState(): number {
    return this.s;
  }

  setState(s: number): void {
    this.s = s >>> 0;
  }

  /** Derive an independent child stream (e.g. per-cell decoration scatter). */
  fork(streamId: number): Rng {
    return new Rng((this.s ^ Math.imul(streamId + 1, 0x85ebca6b)) >>> 0);
  }
}

/** Stateless coordinate hash in [0,1). Deterministic from (x, y, seed). */
export function hash2(x: number, y: number, seed: number): number {
  let h = seed >>> 0;
  h = Math.imul(h ^ Math.imul(x | 0, 0x27d4eb2f), 0x165667b1);
  h = Math.imul(h ^ Math.imul(y | 0, 0x9e3779b1), 0x85ebca6b);
  h ^= h >>> 15;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Value noise in [0,1). Pure function of coordinates and seed. */
export function noise2(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  const u = smooth(xf);
  const v = smooth(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Fractal (fbm) noise in [0,1). */
export function fbm2(x: number, y: number, seed: number, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2(x * freq, y * freq, seed + i * 1013);
    amp *= 0.5;
    freq *= 2;
  }
  return sum;
}
