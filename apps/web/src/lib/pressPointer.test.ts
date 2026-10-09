import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { followPresses, type Presses } from './pressPointer';

let presses: Presses;
let area: HTMLDivElement;
let button: HTMLButtonElement;

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
    presses.press('pen', area);
    expect(presses.pointer()).toBe('pen');
    presses.forget();
    expect(presses.pointer()).toBeNull();
  });

  it('keeps a press released on its element for the click that follows', () => {
    presses.press('mouse', area);
    pointer('pointerup', button);
    expect(presses.pointer()).toBe('mouse');
  });

  it('forgets a press released off its element at once', () => {
    presses.press('mouse', area);
    pointer('pointerup', document.body);
    expect(presses.pointer()).toBeNull();
  });

  it('forgets a cancelled press at once', () => {
    presses.press('touch', area);
    pointer('pointercancel', button);
    expect(presses.pointer()).toBeNull();
  });

  it('stops following releases once stopped', () => {
    presses.press('mouse', area);
    presses.stop();
    pointer('pointercancel', button);
    expect(presses.pointer()).toBe('mouse');
  });
});
