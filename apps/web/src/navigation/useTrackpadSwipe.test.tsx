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

function swipe(target: Element, dx: number, { dy = 0, shiftKey = false } = {}) {
  clock += GESTURE_GAP_MS * 2;
  const events: WheelEvent[] = [];
  for (let i = 0; i < 6; i += 1) {
    const event = new WheelEvent('wheel', {
      deltaX: dx / 6,
      deltaY: dy / 6,
      shiftKey,
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

  it('leaves a short swipe, a vertical scroll and a Shift wheel alone', () => {
    renderStack('/p/MOB');
    const content = page('/p/MOB');
    swipe(content, -60);
    const scroll = swipe(content, -300, { dy: 400 });
    swipe(content, -300, { shiftKey: true });
    expect(location()).toBe('/p/MOB');
    expect(scroll.some((event) => event.defaultPrevented)).toBe(false);
  });

  it('leaves a swipe over a sideways scroller to the scroller', () => {
    renderStack('/p/MOB');
    const row = page('/p/MOB').parentElement!.querySelector('[data-testid="row"]')!;
    Object.defineProperty(row, 'scrollWidth', { value: 900 });
    Object.defineProperty(row, 'clientWidth', { value: 300 });
    swipe(row, -300);
    expect(location()).toBe('/p/MOB');
  });

  it('does nothing at the first screen', () => {
    renderStack('/');
    const events = swipe(page('/'), -300);
    expect(location()).toBe('/');
    expect(document.querySelector('[data-swipe-hint]')).toHaveAttribute('data-swipe-hint', 'back');
    expect(events.every((event) => event.defaultPrevented)).toBe(true);
  });
});
