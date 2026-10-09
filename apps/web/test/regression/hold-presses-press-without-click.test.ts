import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { holdPresses } from '../../src/lib/holdPresses';

// PT-106: holdPresses remembered a press's pointer until a click came. A press that ended without
// one (dragged off, or taken by a scroll) left it behind, so a later click with no pointer of its
// own, such as VoiceOver's, passed for a mouse's single click and went through the hold.

let button: HTMLButtonElement;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  const screen = document.createElement('div');
  button = document.createElement('button');
  screen.append(button);
  document.body.append(screen);
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  document.body.replaceChildren();
});

const pointer = (type: string, target: Element) =>
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: 'mouse' }));

const click = () => {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 });
  button.dispatchEvent(event);
  return event;
};

describe('regression: holdPresses forgets a press that ended without a click', () => {
  it('holds a click with no pointer after a mouse press dragged off', () => {
    holdPresses(button);
    pointer('pointerdown', button);
    pointer('pointerup', document.body);
    vi.advanceTimersByTime(0);

    expect(click().defaultPrevented).toBe(true);
  });

  it('holds a click with no pointer after a mouse press the browser cancelled', () => {
    holdPresses(button);
    pointer('pointerdown', button);
    pointer('pointercancel', button);

    expect(click().defaultPrevented).toBe(true);
  });

  it('holds a click with no pointer that comes before any timer after the release', () => {
    holdPresses(button);
    pointer('pointerdown', button);
    pointer('pointerup', document.body);

    expect(click().defaultPrevented).toBe(true);
  });

  it('still lets the click a mouse press makes through', () => {
    holdPresses(button);
    pointer('pointerdown', button);
    pointer('pointerup', button);

    expect(click().defaultPrevented).toBe(false);
  });
});
