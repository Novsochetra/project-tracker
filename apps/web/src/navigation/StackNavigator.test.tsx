import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockPhone, skipAnimations } from '../overlays/testing';
import { routePath, type Route } from './routes';
import { useScreen } from './ScreenContext';
import { StackNavigator } from './StackNavigator';
import { useNavigation } from './useNavigation';

function Screen({ route }: { route: Route }) {
  const { push, back, canGoBack } = useNavigation();
  const { isTop } = useScreen();
  return (
    <div>
      <p>
        {routePath(route)} {isTop ? 'on top' : 'below'}
      </p>
      {route.name === 'projects' && (
        <button type="button" onClick={() => push({ name: 'project', key: 'MOB' })}>
          Open MOB
        </button>
      )}
      {route.name === 'project' && (
        <button type="button" onClick={() => push('/p/MOB/3')}>
          Open MOB-3
        </button>
      )}
      {canGoBack && (
        <button type="button" onClick={back}>
          Back
        </button>
      )}
    </div>
  );
}

function Probe() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output aria-label="Location">{pathname}</output>
      <button type="button" onClick={() => void navigate(1)}>
        Browser forward
      </button>
    </>
  );
}

function renderStack(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <StackNavigator renderScreen={(route) => <Screen route={route} />} />
      <Probe />
    </MemoryRouter>,
  );
}

const layerPaths = () =>
  [...document.querySelectorAll('[data-stack-path]')].map((layer) =>
    layer.getAttribute('data-stack-path'),
  );
const location = () => screen.getByRole('status', { name: 'Location' }).textContent;

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations()];
});

afterEach(() => {
  restore.forEach((undo) => undo());
  vi.restoreAllMocks();
});

describe('StackNavigator', () => {
  it('mounts every level of a deep link and only the top one is interactive', () => {
    renderStack('/p/MOB/3');
    expect(layerPaths()).toEqual(['/', '/p/MOB', '/p/MOB/3']);
    const top = document.querySelector('[data-stack-path="/p/MOB/3"]');
    const below = document.querySelector('[data-stack-path="/p/MOB"]');
    expect(top).not.toHaveAttribute('inert');
    expect(top).not.toHaveAttribute('aria-hidden');
    expect(below).toHaveAttribute('inert');
    expect(below).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('/p/MOB/3 on top')).toBeInTheDocument();
    expect(screen.getByText('/p/MOB below', { exact: false })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Back' })).toHaveLength(1);
  });

  it('pushes a screen over the current one', async () => {
    const user = userEvent.setup();
    renderStack('/');
    await user.click(screen.getByRole('button', { name: 'Open MOB' }));
    expect(location()).toBe('/p/MOB');
    await waitFor(() => expect(layerPaths()).toEqual(['/', '/p/MOB']));
    expect(screen.getByText('/p/MOB on top')).toBeInTheDocument();
  });

  it('goes back through history when the parent is the previous entry', async () => {
    const user = userEvent.setup();
    renderStack('/');
    await user.click(screen.getByRole('button', { name: 'Open MOB' }));
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(location()).toBe('/');
    await waitFor(() => expect(layerPaths()).toEqual(['/']));
    await user.click(screen.getByRole('button', { name: 'Browser forward' }));
    expect(location()).toBe('/p/MOB');
  });

  it('replaces a deep link with its parent instead of leaving the app', async () => {
    const user = userEvent.setup();
    renderStack('/p/MOB/3');
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(location()).toBe('/p/MOB');
    await waitFor(() => expect(layerPaths()).toEqual(['/', '/p/MOB']));
    await user.click(screen.getByRole('button', { name: 'Browser forward' }));
    expect(location()).toBe('/p/MOB');
  });

  it('moves focus into a pushed screen and back to the row that opened it', async () => {
    const user = userEvent.setup();
    renderStack('/');
    const opener = screen.getByRole('button', { name: 'Open MOB' });
    await user.click(opener);
    const pushed = document.querySelector('[data-stack-path="/p/MOB"] [data-stack-scroller]');
    expect(pushed).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await waitFor(() => expect(layerPaths()).toEqual(['/']));
    expect(opener).toHaveFocus();
  });

  it('keeps the popped screen until its exit animation ends', async () => {
    const user = userEvent.setup();
    restore.forEach((undo) => undo());
    renderStack('/');
    await user.click(screen.getByRole('button', { name: 'Open MOB' }));
    await waitFor(() => expect(layerPaths()).toEqual(['/', '/p/MOB']));
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(location()).toBe('/');
    await waitFor(() => expect(layerPaths()).toEqual(['/']));
  });
});

describe('edge swipe back on phones', () => {
  beforeEach(() => {
    restore.push(mockPhone(true));
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 375,
      bottom: 812,
      width: 375,
      height: 812,
      toJSON: () => ({}),
    });
  });

  const topRole = () =>
    document.querySelector('[data-stack-path="/p/MOB/3"]')?.getAttribute('data-role');

  async function renderSettled(path: string) {
    renderStack(path);
    await waitFor(() => expect(topRole()).toBe('top'));
  }

  // Holds still before lifting so the release is decided by distance, not by a flick.
  async function swipe(fromX: number, toX: number) {
    const root = document.querySelector('[data-stack-navigator]')!;
    const base = { pointerId: 3, pointerType: 'touch', isPrimary: true, button: 0, clientY: 300 };
    fireEvent.pointerDown(root, { ...base, clientX: fromX });
    fireEvent.pointerMove(root, { ...base, clientX: fromX + 20 });
    fireEvent.pointerMove(root, { ...base, clientX: toX });
    await new Promise((resolve) => setTimeout(resolve, 120));
    act(() => {
      fireEvent.pointerUp(root, { ...base, clientX: toX });
    });
  }

  it('reveals the parent while dragging from the left edge', async () => {
    await renderSettled('/p/MOB/3');
    const root = document.querySelector('[data-stack-navigator]')!;
    const base = { pointerId: 4, pointerType: 'touch', isPrimary: true, button: 0, clientY: 300 };
    fireEvent.pointerDown(root, { ...base, clientX: 8 });
    fireEvent.pointerMove(root, { ...base, clientX: 60 });
    fireEvent.pointerMove(root, { ...base, clientX: 120 });
    expect(document.querySelector('[data-stack-path="/p/MOB/3"]')).toHaveAttribute(
      'data-role',
      'front',
    );
    expect(document.querySelector('[data-stack-path="/p/MOB"]')).toHaveAttribute(
      'data-role',
      'back',
    );
    fireEvent.pointerUp(root, { ...base, clientX: 120 });
  });

  it('completes past a third of the width and navigates to the parent', async () => {
    await renderSettled('/p/MOB/3');
    await swipe(6, 220);
    await waitFor(() => expect(location()).toBe('/p/MOB'));
    await waitFor(() => expect(layerPaths()).toEqual(['/', '/p/MOB']));
    expect(document.querySelector('[data-stack-path="/p/MOB"]')).toHaveAttribute(
      'data-role',
      'top',
    );
  });

  it('springs back on a short swipe', async () => {
    await renderSettled('/p/MOB/3');
    await swipe(6, 60);
    await waitFor(() => expect(topRole()).toBe('top'));
    expect(location()).toBe('/p/MOB/3');
  });

  it('ignores touches away from the edge', async () => {
    await renderSettled('/p/MOB/3');
    await swipe(80, 300);
    expect(topRole()).toBe('top');
    expect(location()).toBe('/p/MOB/3');
  });
});
