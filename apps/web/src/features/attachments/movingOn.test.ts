import { afterEach, describe, expect, it, vi } from 'vitest';
import { watchMovingOn } from './movingOn';

let stop: () => void = () => undefined;

afterEach(() => {
  stop();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function watch() {
  const drop = vi.fn();
  stop = watchMovingOn(drop);
  return drop;
}

const field = () => {
  const input = document.createElement('input');
  document.body.append(input);
  return input;
};

describe('watchMovingOn', () => {
  it.each([
    ['a press', () => new PointerEvent('pointerdown', { bubbles: true })],
    ['a key', () => new KeyboardEvent('keydown', { key: 'a', bubbles: true })],
    ['a focus', () => new FocusEvent('focusin', { bubbles: true })],
    ['a wheel', () => new WheelEvent('wheel', { deltaY: 40, bubbles: true })],
    ['text put in a field', () => new InputEvent('input', { bubbles: true })],
  ])('drops on %s anywhere in the page', (_, event) => {
    const drop = watch();
    field().dispatchEvent(event());
    expect(drop).toHaveBeenCalledTimes(1);
  });

  it('hears an event a control stops from bubbling', () => {
    const drop = watch();
    const input = field();
    input.addEventListener('keydown', (event) => event.stopPropagation());
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(drop).toHaveBeenCalledTimes(1);
  });

  it('uses up Escape, but no other key', () => {
    watch();
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    field().dispatchEvent(escape);
    field().dispatchEvent(enter);
    expect(escape.defaultPrevented).toBe(true);
    expect(enter.defaultPrevented).toBe(false);
  });

  it("drops when the page is hidden or the browser's Back or Forward goes, not when it shows", () => {
    const drop = watch();
    const state = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(drop).not.toHaveBeenCalled();
    state.mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(drop).toHaveBeenCalledTimes(2);
  });

  it('keeps it through a pointer that only moves', () => {
    const drop = watch();
    field().dispatchEvent(new PointerEvent('pointermove', { bubbles: true }));
    field().dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    expect(drop).not.toHaveBeenCalled();
  });

  it('stops listening once stopped', () => {
    const drop = watch();
    stop();
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    field().dispatchEvent(escape);
    field().dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    field().dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    window.dispatchEvent(new PopStateEvent('popstate'));
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(drop).not.toHaveBeenCalled();
    expect(escape.defaultPrevented).toBe(false);
  });
});
