import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { followPresses, type Presses } from './pressPointer';

let presses: Presses;
let area: HTMLDivElement;
let button: HTMLButtonElement;

const primary = (pointerType: string) => ({ pointerType, button: 0 });

const pointer = (type: 'pointerup' | 'pointercancel', target: EventTarget) =>
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: 'mouse' }));

beforeEach(() => {
  area = document.createElement('div');
  button = document.createElement('button');
  area.append(button);
  document.body.append(area);
  presses = followPresses();
});

afterEach(() => {
  presses.stop();
  document.body.replaceChildren();
});

describe('followPresses', () => {
  it('tells the pointer of a press, until it is forgotten', () => {
    presses.press(primary('pen'), area);
    expect(presses.pointer()).toBe('pen');
    presses.forget();
    expect(presses.pointer()).toBeNull();
  });

  it('keeps a press released on its element for the click that follows', () => {
    presses.press(primary('mouse'), area);
    pointer('pointerup', button);
    expect(presses.pointer()).toBe('mouse');
  });

  it('forgets a press released off its element at once', () => {
    presses.press(primary('mouse'), area);
    pointer('pointerup', document.body);
    expect(presses.pointer()).toBeNull();
  });

  it('forgets a cancelled press at once', () => {
    presses.press(primary('touch'), area);
    pointer('pointercancel', button);
    expect(presses.pointer()).toBeNull();
  });

  // A Mac's ctrl+click: the primary button's press, a context menu and no click (Chromium).
  it('forgets a press that opens a context menu', () => {
    presses.press(primary('mouse'), area);
    button.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, ctrlKey: true }));
    expect(presses.pointer()).toBeNull();
  });

  it("takes no press of another button for a click's, and keeps the one before it", () => {
    presses.press({ pointerType: 'mouse', button: 2 }, area);
    expect(presses.pointer()).toBeNull();
    presses.press(primary('touch'), area);
    presses.press({ pointerType: 'pen', button: 5 }, area);
    expect(presses.pointer()).toBe('touch');
  });

  it('stops following releases and context menus once stopped', () => {
    presses.press(primary('mouse'), area);
    presses.stop();
    pointer('pointercancel', button);
    button.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
    expect(presses.pointer()).toBe('mouse');
  });
});
