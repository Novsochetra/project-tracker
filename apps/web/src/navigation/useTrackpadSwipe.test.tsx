import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { skipAnimations } from '../overlays/testing';
import { routePath, type Route } from './routes';
import { StackNavigator } from './StackNavigator';
import { GESTURE_GAP_MS } from './trackpadSwipe';
import { useNavigation } from './useNavigation';

function Screen({ route }: { route: Route }) {
  const { push } = useNavigation();

  return (
    <div>
      <p>{routePath(route)}</p>
      {route.name === 'projects' && (
        <button type="button" onClick={() => push({ name: 'project', key: 'MOB' })}>
          Open MOB
        </button>
      )}
      <div data-testid="row" style={{ overflowX: 'auto' }}>
        <span>Wide row</span>
      </div>
    </div>
  );
}

function Probe() {
  return <output aria-label="Location">{useLocation().pathname}</output>;
}

function renderStack(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <StackNavigator renderScreen={(route) => <Screen route={route} />} />
      <Probe />
    </MemoryRouter>,
  );
}

const page = (path: string) => document.querySelector(`[data-stack-path="${path}"] p`)!;
const location = () => screen.getByRole('status', { name: 'Location' }).textContent;

let clock = 0;

function swipe(target: Element, dx: number, { dy = 0, shiftKey = false, ctrlKey = false } = {}) {
  clock += GESTURE_GAP_MS * 2;
  const events: WheelEvent[] = [];
  for (let i = 0; i < 6; i += 1) {
    const event = new WheelEvent('wheel', {
      deltaX: dx / 6,
      deltaY: dy / 6,
      shiftKey,
      ctrlKey,
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, 'timeStamp', { value: (clock += 16) });
    act(() => {
      target.dispatchEvent(event);
    });
    events.push(event);
  }

  return events;
}

let restore: () => void = () => undefined;

beforeEach(() => {
  restore = skipAnimations();
});

afterEach(() => restore());

describe('trackpad swipe', () => {
  it('goes back and then forward again through the history', async () => {
    renderStack('/');
    await userEvent.click(screen.getByRole('button', { name: 'Open MOB' }));
    expect(location()).toBe('/p/MOB');

    const events = swipe(page('/p/MOB'), -300);
    expect(location()).toBe('/');
    expect(events.every((event) => event.defaultPrevented)).toBe(true);

    swipe(page('/'), 300);
    expect(location()).toBe('/p/MOB');
  });

  it('goes to the parent screen from a deep link', () => {
    renderStack('/p/MOB');
    swipe(page('/p/MOB'), -300);
    expect(location()).toBe('/');
  });

  it('leaves a short swipe, a vertical scroll, a Shift wheel and a pinch alone', () => {
    renderStack('/p/MOB');
    const content = page('/p/MOB');
    swipe(content, -60);
    const scroll = swipe(content, -300, { dy: 400 });
    const shifted = swipe(content, -300, { shiftKey: true });
    const pinch = swipe(content, -300, { ctrlKey: true });
    expect(location()).toBe('/p/MOB');
    for (const events of [scroll, shifted, pinch]) {
      expect(events.some((event) => event.defaultPrevented)).toBe(false);
    }
  });

  it('leaves a swipe alone while a dropdown is open', () => {
    renderStack('/p/MOB');
    const listbox = document.createElement('div');
    listbox.setAttribute('role', 'listbox');
    document.body.append(listbox);
    swipe(page('/p/MOB'), -300);
    listbox.remove();
    expect(location()).toBe('/p/MOB');
  });

  it('leaves a swipe over a sideways scroller to the scroller', () => {
    renderStack('/p/MOB');
    const row = page('/p/MOB').parentElement!.querySelector('[data-testid="row"]')!;
    Object.defineProperty(row, 'scrollWidth', { value: 900 });
    Object.defineProperty(row, 'clientWidth', { value: 300 });
    swipe(row, -300);
    expect(location()).toBe('/p/MOB');
  });

  it('lets a tiny first event with nowhere to go reach the browser', () => {
    renderStack('/');
    const event = new WheelEvent('wheel', { deltaX: -1, bubbles: true, cancelable: true });
    Object.defineProperty(event, 'timeStamp', { value: (clock += GESTURE_GAP_MS * 2) });
    act(() => {
      page('/').dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(false);
  });

  it('leaves a swipe with nowhere to go to the browser', () => {
    renderStack('/');
    const events = swipe(page('/'), -300);
    expect(location()).toBe('/');
    expect(document.querySelector('[data-swipe-hint]')).toBeNull();
    expect(events.some((event) => event.defaultPrevented)).toBe(false);
  });
});
