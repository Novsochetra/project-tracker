import { afterEach, describe, expect, it, vi } from 'vitest';
import { momentumDuration } from './animation';
import { haptic, HAPTIC_PATTERNS } from './haptics';
import { clamp, lerp, lockAxis, projectDistance, rubberBand, rubberBandClamp } from './math';
import { canScrollUpWithin, decidePull } from './topPull';
import { VelocityTracker } from './velocity';

describe('rubberBand', () => {
  it('is zero at the edge and always smaller than the pull', () => {
    expect(rubberBand(0, 300)).toBe(0);
    for (const pull of [10, 100, 400, 2000]) {
      const stretched = rubberBand(pull, 300);
      expect(stretched).toBeGreaterThan(0);
      expect(stretched).toBeLessThan(pull);
      expect(stretched).toBeLessThan(300);
    }
  });

  it('starts at the constant slope and keeps the sign', () => {
    expect(rubberBand(1, 1000)).toBeCloseTo(0.55, 2);
    expect(rubberBand(-120, 300)).toBeCloseTo(-rubberBand(120, 300));
  });

  it('grows monotonically', () => {
    expect(rubberBand(200, 300)).toBeGreaterThan(rubberBand(100, 300));
  });

  it('ignores an empty dimension', () => {
    expect(rubberBand(50, 0)).toBe(0);
  });
});

describe('rubberBandClamp', () => {
  it('passes values inside the range through', () => {
    expect(rubberBandClamp(50, 0, 100, 300)).toBe(50);
  });

  it('resists past either end', () => {
    expect(rubberBandClamp(160, 0, 100, 300)).toBeGreaterThan(100);
    expect(rubberBandClamp(160, 0, 100, 300)).toBeLessThan(160);
    expect(rubberBandClamp(-60, 0, 100, 300)).toBeLessThan(0);
    expect(rubberBandClamp(-60, 0, 100, 300)).toBeGreaterThan(-60);
  });
});

describe('small helpers', () => {
  it('clamps and interpolates', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(lerp(10, 20, 0.25)).toBe(12.5);
  });

  it('projects a flick forward in its direction', () => {
    expect(projectDistance(1000)).toBeCloseTo(499, 0);
    expect(projectDistance(-1000)).toBeLessThan(0);
    expect(projectDistance(0)).toBe(0);
  });

  it('locks the axis after the slop', () => {
    expect(lockAxis(3, 2)).toBeNull();
    expect(lockAxis(12, 4)).toBe('x');
    expect(lockAxis(-3, -15)).toBe('y');
    expect(lockAxis(10, 10)).toBe('y');
  });
});

describe('momentumDuration', () => {
  const limits = { minMs: 180, maxMs: 380 };

  it('keeps the finger speed when that fits the limits', () => {
    expect(momentumDuration(-0.5, { velocity: -3, ...limits })).toBeCloseTo(375);
    expect(momentumDuration(200, { velocity: 1800, ...limits })).toBeCloseTo(250);
  });

  it('clamps very fast and very slow releases', () => {
    expect(momentumDuration(-0.8, { velocity: -40, ...limits })).toBe(180);
    expect(momentumDuration(-0.8, { velocity: -0.5, ...limits })).toBe(380);
  });

  it('uses the slow duration when released backwards or at rest', () => {
    expect(momentumDuration(0.4, { velocity: -2, ...limits })).toBe(380);
    expect(momentumDuration(0.4, { velocity: 0, ...limits })).toBe(380);
    expect(momentumDuration(0, { velocity: 2, ...limits })).toBe(380);
  });
});

describe('VelocityTracker', () => {
  it('measures px per second over the recent window', () => {
    const tracker = new VelocityTracker();
    tracker.add(0, 0, 0);
    tracker.add(16, 16, 8);
    tracker.add(32, 32, 16);
    expect(tracker.velocity(32)).toEqual({ x: 1000, y: 500 });
  });

  it('forgets old movement', () => {
    const tracker = new VelocityTracker();
    tracker.add(0, 0, 0);
    tracker.add(100, 500, 0);
    tracker.add(200, 500, 0);
    tracker.add(216, 516, 0);
    expect(tracker.velocity(216).x).toBeCloseTo(1000);
  });

  it('reports zero when the finger stopped before lifting', () => {
    const tracker = new VelocityTracker();
    tracker.add(0, 0, 0);
    tracker.add(16, 40, 0);
    expect(tracker.velocity(200)).toEqual({ x: 0, y: 0 });
  });

  it('needs two samples', () => {
    const tracker = new VelocityTracker();
    expect(tracker.velocity(0)).toEqual({ x: 0, y: 0 });
    tracker.add(0, 5, 5);
    expect(tracker.velocity(0)).toEqual({ x: 0, y: 0 });
    tracker.reset();
    expect(tracker.velocity(0)).toEqual({ x: 0, y: 0 });
  });
});

describe('decidePull', () => {
  it('waits for real movement', () => {
    expect(decidePull(1, 2, 0)).toBe('wait');
  });

  it('engages a downward drag at the top', () => {
    expect(decidePull(2, 6, 0)).toBe('engage');
    expect(decidePull(0, 6, -3)).toBe('engage');
  });

  it('leaves upward, sideways and scrolled drags to the browser', () => {
    expect(decidePull(0, -6, 0)).toBe('ignore');
    expect(decidePull(8, 6, 0)).toBe('ignore');
    expect(decidePull(0, 6, 40)).toBe('ignore');
  });
});

describe('canScrollUpWithin', () => {
  it('finds a scrolled element between the target and the container', () => {
    const container = document.createElement('div');
    const inner = document.createElement('div');
    const target = document.createElement('span');
    inner.append(target);
    container.append(inner);
    expect(canScrollUpWithin(target, container)).toBe(false);
    inner.scrollTop = 20;
    Object.defineProperty(inner, 'scrollTop', { value: 20 });
    expect(canScrollUpWithin(target, container)).toBe(true);
    expect(canScrollUpWithin(null, container)).toBe(false);
  });
});

describe('haptic', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('vibrates with the pattern for the kind', () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate });
    haptic('success');
    haptic('selection');
    expect(vibrate).toHaveBeenNthCalledWith(1, HAPTIC_PATTERNS.success);
    expect(vibrate).toHaveBeenNthCalledWith(2, HAPTIC_PATTERNS.selection);
  });

  it('does nothing without the Vibration API', () => {
    vi.stubGlobal('navigator', {});
    expect(() => haptic('warning')).not.toThrow();
  });
});
