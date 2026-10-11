import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { endHolds, holdPresses } from '../../src/lib/holdPresses';

// PT-167: a hold ends CLICK_SHIELD_MS after the tap on a timer. A test that tapped right before it
// ended left that timer behind, and it fired once the test file's page had gone ("window is not
// defined"), which failed a verify run whose tests had all passed. Tests now end every hold with
// the test (test/setup.ts).

let button: HTMLButtonElement;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  button = document.createElement('button');
  document.body.append(button);
});

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

const doubleClick = () => {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 2 });
  button.dispatchEvent(event);
  return event;
};

it('leaves no timer and no held press behind once holds end', () => {
  holdPresses(button);
  expect(doubleClick().defaultPrevented).toBe(true);

  endHolds();

  expect(vi.getTimerCount()).toBe(0);
  expect(doubleClick().defaultPrevented).toBe(false);
});
