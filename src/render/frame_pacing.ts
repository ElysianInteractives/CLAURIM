/** Presentation-only dynamic pixel density. Geometry detail and simulation
 * remain unchanged; only the raster resolution responds to sustained load. */
export class AdaptivePixelRatio {
  private ratio: number;
  private averageFrameSeconds = 1 / 60;
  private slowSeconds = 0;
  private fastSeconds = 0;

  constructor(
    private readonly ceiling: number,
    private readonly floor = Math.min(0.75, ceiling),
    initial = ceiling,
  ) {
    this.ratio = Math.max(floor, Math.min(ceiling, initial));
  }

  current(): number {
    return this.ratio;
  }

  atFloor(): boolean {
    return this.ratio <= this.floor + 1e-9;
  }

  /** Returns a new ratio only when the renderer should resize its target. */
  observe(dtSec: number): number | null {
    if (!Number.isFinite(dtSec) || dtSec <= 0 || dtSec > 0.1) return null;
    const blend = 1 - Math.exp(-dtSec * 4);
    this.averageFrameSeconds += (dtSec - this.averageFrameSeconds) * blend;

    if (this.averageFrameSeconds > 1 / 50 && this.ratio > this.floor) {
      this.slowSeconds += dtSec;
      this.fastSeconds = 0;
      if (this.slowSeconds >= 0.75) {
        this.ratio = Math.max(this.floor, this.ratio - 0.25);
        this.slowSeconds = 0;
        return this.ratio;
      }
      return null;
    }
    if (this.averageFrameSeconds < 1 / 58 && this.ratio < this.ceiling) {
      this.fastSeconds += dtSec;
      this.slowSeconds = 0;
      if (this.fastSeconds >= 4) {
        this.ratio = Math.min(this.ceiling, this.ratio + 0.25);
        this.fastSeconds = 0;
        return this.ratio;
      }
      return null;
    }
    this.slowSeconds = 0;
    this.fastSeconds = 0;
    return null;
  }
}

export type GeometryDetailTier = 'high' | 'performance';

/** Last-resort geometry protection for devices that remain slow after raster
 * density has reached its floor. The local player never leaves high detail;
 * the renderer applies this tier only to surrounding presentation. */
export class AdaptiveGeometryDetail {
  private tier: GeometryDetailTier = 'high';
  private averageFrameSeconds = 1 / 60;
  private slowSeconds = 0;
  private fastSeconds = 0;

  current(): GeometryDetailTier {
    return this.tier;
  }

  observe(dtSec: number, rasterAtFloor: boolean): GeometryDetailTier | null {
    if (!Number.isFinite(dtSec) || dtSec <= 0 || dtSec > 0.1) return null;
    const blend = 1 - Math.exp(-dtSec * 3);
    this.averageFrameSeconds += (dtSec - this.averageFrameSeconds) * blend;

    if (this.tier === 'high') {
      this.fastSeconds = 0;
      if (rasterAtFloor && this.averageFrameSeconds > 1 / 45) {
        this.slowSeconds += dtSec;
        if (this.slowSeconds >= 1) {
          this.tier = 'performance';
          this.slowSeconds = 0;
          return this.tier;
        }
      } else {
        this.slowSeconds = 0;
      }
      return null;
    }

    this.slowSeconds = 0;
    if (this.averageFrameSeconds < 1 / 57) {
      this.fastSeconds += dtSec;
      if (this.fastSeconds >= 6) {
        this.tier = 'high';
        this.fastSeconds = 0;
        return this.tier;
      }
    } else {
      this.fastSeconds = 0;
    }
    return null;
  }
}
