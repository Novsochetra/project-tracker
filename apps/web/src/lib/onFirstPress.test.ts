import { describe, expect, it, vi } from 'vitest';
import { onFirstPress } from './onFirstPress';

describe('onFirstPress', () => {
  it.each(['pointerover', 'pointerdown', 'keydown'])('runs on the first %s', (type) => {
    const target = new EventTarget();
    const run = vi.fn();
    onFirstPress(run, target);
    expect(run).not.toHaveBeenCalled();
    target.dispatchEvent(new Event(type));
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('runs once, whatever follows', () => {
    const target = new EventTarget();
    const run = vi.fn();
    onFirstPress(run, target);
    for (const type of ['pointerover', 'pointerdown', 'keydown', 'pointerdown']) {
      target.dispatchEvent(new Event(type));
    }
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('does nothing on other events, or once stopped', () => {
    const target = new EventTarget();
    const run = vi.fn();
    const stop = onFirstPress(run, target);
    target.dispatchEvent(new Event('scroll'));
    stop();
    target.dispatchEvent(new Event('pointerdown'));
    expect(run).not.toHaveBeenCalled();
  });
});
