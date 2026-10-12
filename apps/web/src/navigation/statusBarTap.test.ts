import { describe, expect, it, vi } from 'vitest';
import { RESTING_Y, watchStatusBarTap } from './statusBarTap';

class FakeWindow extends EventTarget {
  scrollY = 0;
  pinned = false;

  scrollTo(_x: number, y: number): void {
    if (!this.pinned) this.scrollY = y;
  }

  moveTo(y: number): void {
    this.scrollY = y;
    this.dispatchEvent(new Event('scroll'));
  }

  touch(type: 'touchstart' | 'touchend', fingers: number): void {
    this.dispatchEvent(Object.assign(new Event(type), { touches: { length: fingers } }));
  }
}

function watch(win = new FakeWindow()) {
  const onTap = vi.fn();
  const stop = watchStatusBarTap(win as unknown as Window, {
    onTap,
    isLocked: () => win.pinned,
  });
  return { win, onTap, stop };
}

describe('watchStatusBarTap', () => {
  it('rests the window 1px down', () => {
    expect(watch().win.scrollY).toBe(RESTING_Y);
  });

  it('waits for the sheet to let go before resting the window', () => {
    const win = new FakeWindow();
    win.pinned = true;
    watch(win);
    expect(win.scrollY).toBe(0);
  });

  it('takes a scroll from rest to 0 as the tap, and rests again', () => {
    const { win, onTap } = watch();
    win.moveTo(0);
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(win.scrollY).toBe(RESTING_Y);
    win.moveTo(0);
    expect(onTap).toHaveBeenCalledTimes(2);
  });

  it('ignores a finger dragging the window to 0, and rests it when the finger lifts', () => {
    const { win, onTap } = watch();
    win.touch('touchstart', 1);
    win.moveTo(0);
    win.touch('touchend', 0);
    expect(onTap).not.toHaveBeenCalled();
    expect(win.scrollY).toBe(RESTING_Y);
  });

  it('ignores the window coming back to 0 after the keyboard moved the page', () => {
    const { win, onTap } = watch();
    win.moveTo(300);
    win.moveTo(0);
    expect(onTap).not.toHaveBeenCalled();
    expect(win.scrollY).toBe(RESTING_Y);
  });

  it('counts the tap again once the page is back at rest', () => {
    const { win, onTap } = watch();
    win.moveTo(16);
    win.moveTo(RESTING_Y);
    win.moveTo(0);
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it('ignores a sheet pinning the body, which takes the window to 0', () => {
    const { win, onTap } = watch();
    win.pinned = true;
    win.moveTo(0);
    win.pinned = false;
    win.moveTo(RESTING_Y);
    expect(onTap).not.toHaveBeenCalled();
    win.moveTo(0);
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it('stops listening when stopped', () => {
    const { win, onTap, stop } = watch();
    stop();
    win.moveTo(0);
    expect(onTap).not.toHaveBeenCalled();
  });
});
