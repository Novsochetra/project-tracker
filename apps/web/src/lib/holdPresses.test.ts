import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLICK_SHIELD_MS } from './clickShield';
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
  Reflect.deleteProperty(document, 'elementFromPoint');
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

describe("holdPresses on a screen's bars", () => {
  let note: HTMLParagraphElement;

  const bar = (position: 'fixed' | 'sticky', y: number) => {
    const element = document.createElement('div');
    element.style.position = position;
    let box = new DOMRect(0, y, 375, 50);
    element.getBoundingClientRect = () => box;
    const control = document.createElement('button');
    control.addEventListener('click', pressed);
    element.append(control);
    return { element, control, move: () => void (box = new DOMRect(0, y + 10, 375, 50)) };
  };

  const tapOn = (target: Element) => {
    target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }));
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 });
    target.dispatchEvent(event);
    return event;
  };

  // What the browser finds along the top and the bottom of the screen.
  const showing = (top: Element, bottom: Element) => {
    document.elementFromPoint = (_x: number, y: number) => (y === 0 ? top : bottom);
  };

  beforeEach(() => {
    note = document.createElement('p');
  });

  it('lets a tap on a nav bar or bottom bar through while they stay where they were', () => {
    const navBar = bar('sticky', 0);
    const bottomBar = bar('fixed', 760);
    screen.append(navBar.element, note, bottomBar.element);
    showing(navBar.control, bottomBar.control);

    holdPresses(note);

    expect(tapOn(navBar.control).defaultPrevented).toBe(false);
    expect(tapOn(bottomBar.control).defaultPrevented).toBe(false);
    expect(tapOn(button).defaultPrevented).toBe(true);
    expect(pressed).toHaveBeenCalledTimes(2);
  });

  it('holds a bar that moved', () => {
    const bottomBar = bar('fixed', 760);
    screen.append(note, bottomBar.element);
    showing(note, bottomBar.control);

    holdPresses(note);
    bottomBar.move();

    expect(tapOn(bottomBar.control).defaultPrevented).toBe(true);
  });

  it('holds the bar the note is in', () => {
    const bottomBar = bar('fixed', 760);
    bottomBar.element.append(note);
    screen.append(bottomBar.element);
    showing(button, bottomBar.control);

    holdPresses(note);

    expect(tapOn(bottomBar.control).defaultPrevented).toBe(true);
  });

  it('holds all of a sheet: its header moves as it shrinks, and its scrim closes it', () => {
    const scrim = bar('fixed', 0);
    const sheet = document.createElement('div');
    sheet.setAttribute('role', 'dialog');
    sheet.append(note);
    screen.append(scrim.element, sheet);
    showing(scrim.control, scrim.control);

    holdPresses(note);

    expect(tapOn(scrim.control).defaultPrevented).toBe(true);
  });
});
