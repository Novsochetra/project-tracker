import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLICK_SHIELD_MS } from '../../lib/clickShield';
import { holdPresses } from './holdPresses';

let screen: HTMLDivElement;
let button: HTMLButtonElement;
const pressed = vi.fn();

const press = (type: 'mousedown' | 'click', detail: number) => {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, detail });
  button.dispatchEvent(event);
  return event;
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  pressed.mockClear();
  screen = document.createElement('div');
  button = document.createElement('button');
  button.addEventListener('mousedown', pressed);
  button.addEventListener('click', pressed);
  screen.append(button);
  document.body.append(screen);
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('holdPresses', () => {
  it("drops a pointer's presses in the element's screen for CLICK_SHIELD_MS", () => {
    holdPresses(button);
    expect(press('mousedown', 1).defaultPrevented).toBe(true);
    expect(press('click', 1).defaultPrevented).toBe(true);
    vi.advanceTimersByTime(CLICK_SHIELD_MS - 1);
    expect(press('click', 2).defaultPrevented).toBe(true);
    expect(pressed).not.toHaveBeenCalled();
  });

  it('lets presses through after CLICK_SHIELD_MS', () => {
    holdPresses(button);
    vi.advanceTimersByTime(CLICK_SHIELD_MS);
    expect(press('click', 1).defaultPrevented).toBe(false);
    expect(pressed).toHaveBeenCalledTimes(1);
  });

  it('lets a key press (detail 0) through at once', () => {
    holdPresses(button);
    expect(press('click', 0).defaultPrevented).toBe(false);
    expect(pressed).toHaveBeenCalledTimes(1);
  });

  it("lets a mouse's single click through, but not a double-click's second", () => {
    holdPresses(button);
    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }));
    expect(press('click', 1).defaultPrevented).toBe(false);
    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }));
    expect(press('click', 2).defaultPrevented).toBe(true);
    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }));
    expect(press('click', 1).defaultPrevented).toBe(true);
    expect(pressed).toHaveBeenCalledTimes(1);
  });

  it('leaves other layers on the page alone, such as a sheet opened on top', () => {
    const note = document.createElement('p');
    screen.append(note);
    const sheet = document.createElement('div');
    sheet.append(button);
    document.body.append(sheet);
    holdPresses(note);
    expect(press('click', 1).defaultPrevented).toBe(false);
    expect(pressed).toHaveBeenCalledTimes(1);
  });
});
