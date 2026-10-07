import type { Point } from './math';

interface Sample {
  t: number;
  x: number;
  y: number;
}

const WINDOW_MS = 100;
const STALE_MS = 80;

export class VelocityTracker {
  private samples: Sample[] = [];

  reset(): void {
    this.samples = [];
  }

  add(t: number, x: number, y: number): void {
    this.samples.push({ t, x, y });
    const cutoff = t - WINDOW_MS;
    while (this.samples.length > 2 && (this.samples[0]?.t ?? t) < cutoff) this.samples.shift();
  }

  velocity(now: number): Point {
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    if (!first || !last || last === first) return { x: 0, y: 0 };
    // A finger that stopped before lifting should not fling.
    if (now - last.t > STALE_MS) return { x: 0, y: 0 };
    const dt = (last.t - first.t) / 1000;
    if (dt <= 0) return { x: 0, y: 0 };
    return { x: (last.x - first.x) / dt, y: (last.y - first.y) / dt };
  }
}
