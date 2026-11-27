import { ApiError } from '@tracker/client';
import type { ProjectSummary } from '@tracker/shared';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { currentPath, projectSummary, renderWithApp } from '../../app/test/harness';
import { routePath, StackNavigator } from '../../navigation';
import { mockPhone, skipAnimations } from '../../overlays/testing';
import { ProjectsScreen } from './ProjectsScreen';
import { REORDER_ROW_ATTRIBUTE } from './reorder/reorderRows';
import { LIFT_HOLD_MS } from './reorder/touchHold';

const LIST_TOP = 120;
const ROW = 60;

const projects: ProjectSummary[] = ['Alpha', 'Beta', 'Gamma'].map((name) =>
  projectSummary({ id: `p-${name.toLowerCase()}`, name, key: name.slice(0, 3).toUpperCase() }),
);
const [alpha, beta, gamma] = projects.map((project) => project.id);

const box = (top: number, height: number): DOMRect => ({
  x: 16,
  y: top,
  left: 16,
  top,
  width: 343,
  height,
  right: 359,
  bottom: top + height,
  toJSON: () => ({}),
});

// jsdom has no layout: the list at 120, its 60px rows touching, in the order they are in now.
function layout(element: Element): DOMRect {
  const rows = [...document.querySelectorAll(`[${REORDER_ROW_ATTRIBUTE}]`)];
  const index = rows.findIndex((row) => row === element || row.contains(element));
  if (index >= 0) return box(LIST_TOP + index * ROW, ROW);
  if (element.contains(rows[0] ?? null)) return box(LIST_TOP, rows.length * ROW);

  return box(0, 812);
}

const row = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) });
const shownNames = () =>
  [...document.querySelectorAll(`[${REORDER_ROW_ATTRIBUTE}]`)].map(
    (element) => element.textContent?.split(' ')[0],
  );
const wait = (ms: number) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));

function pointer(type: string, clientY: number) {
  act(() => {
    window.dispatchEvent(
      new PointerEvent(type, { pointerId: 2, pointerType: 'touch', clientX: 100, clientY }),
    );
  });
}

function touchDown(target: HTMLElement, clientY: number) {
  fireEvent.pointerDown(target, {
    pointerId: 2,
    pointerType: 'touch',
    button: 0,
    isPrimary: true,
    clientX: 100,
    clientY,
  });
}

// What pull to refresh above the list would hear of a touchmove on a row.
function touchMove(target: HTMLElement) {
  const heard = vi.fn();
  document.addEventListener('touchmove', heard);
  const allowed = fireEvent.touchMove(target, { touches: [{ clientX: 100, clientY: 300 }] });
  document.removeEventListener('touchmove', heard);

  return { prevented: !allowed, heard: heard.mock.calls.length > 0 };
}

const stack = (
  <StackNavigator
    renderScreen={(route) =>
      route.name === 'projects' ? <ProjectsScreen /> : <p>Opened {routePath(route)}</p>
    }
  />
);

async function renderRows(client: Record<string, unknown> = {}) {
  const result = renderWithApp(stack, {
    projects,
    client: { listProjects: vi.fn().mockResolvedValue(projects), ...client },
  });
  await screen.findByRole('button', { name: /^Gamma/ });

  return result;
}

let restore: Array<() => void> = [];
let vibrate = vi.fn();

beforeEach(() => {
  const spy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: Element,
  ) {
    return layout(this);
  });
  vibrate = vi.fn();
  Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrate });
  restore = [
    skipAnimations(),
    mockPhone(true),
    () => spy.mockRestore(),
    () => Reflect.deleteProperty(navigator, 'vibrate'),
  ];
});

afterEach(() => {
  restore.forEach((undo) => undo());
});

describe('reordering projects on the phone', () => {
  it('lifts a row a finger rests on, drags it without scrolling, and saves the order once', async () => {
    const reorderProjects = vi.fn(() => new Promise(() => undefined));
    await renderRows({ reorderProjects });

    touchDown(row('Alpha'), 150);
    await wait(LIFT_HOLD_MS + 50);
    expect(row('Alpha')).toHaveAttribute('data-dragging');
    expect(vibrate).toHaveBeenCalledWith(8);
    expect(touchMove(row('Alpha'))).toEqual({ prevented: true, heard: false });

    pointer('pointermove', 200);
    pointer('pointermove', 280);
    await wait(40);
    expect(row('Alpha').style.transform).toBe('translate3d(0, 120px, 0)');
    expect(row('Beta').style.transform).toBe('translate3d(0, -60px, 0)');
    expect(row('Gamma').style.transform).toBe('translate3d(0, -60px, 0)');
    expect(shownNames()).toEqual(['Alpha', 'Beta', 'Gamma']);

    pointer('pointerup', 280);
    fireEvent.click(row('Alpha'));
    expect(currentPath()).toBe('/');
    expect(shownNames()).toEqual(['Beta', 'Gamma', 'Alpha']);
    expect(row('Alpha')).not.toHaveAttribute('data-dragging');
    await waitFor(() => expect(reorderProjects).toHaveBeenCalledWith([beta, gamma, alpha]));
    expect(reorderProjects).toHaveBeenCalledTimes(1);
    expect(touchMove(row('Alpha'))).toEqual({ prevented: false, heard: true });
  });

  it('leaves a finger that moves before the hold to scroll and pull, and a tap still opens', async () => {
    const reorderProjects = vi.fn();
    await renderRows({ reorderProjects });

    touchDown(row('Beta'), 210);
    expect(touchMove(row('Beta'))).toEqual({ prevented: false, heard: true });
    expect(fireEvent.contextMenu(row('Beta'))).toBe(false);
    pointer('pointermove', 260);
    await wait(LIFT_HOLD_MS + 50);
    expect(row('Beta')).not.toHaveAttribute('data-dragging');
    expect(touchMove(row('Beta'))).toEqual({ prevented: false, heard: true });
    expect(fireEvent.contextMenu(row('Beta'))).toBe(true);
    pointer('pointerup', 260);
    expect(vibrate).not.toHaveBeenCalled();

    fireEvent.click(row('Gamma'));
    expect(currentPath()).toBe('/p/GAM');
    expect(reorderProjects).not.toHaveBeenCalled();
  });

  it('puts the order back and says why when saving it fails', async () => {
    const reorderProjects = vi.fn(() =>
      Promise.reject(new ApiError(409, 'conflict', 'Your projects changed meanwhile.')),
    );
    await renderRows({ reorderProjects });

    touchDown(row('Gamma'), 270);
    await wait(LIFT_HOLD_MS + 50);
    pointer('pointermove', 130);
    await wait(40);
    pointer('pointerup', 130);
    fireEvent.click(row('Gamma'));
    expect(currentPath()).toBe('/');
    expect(shownNames()).toEqual(['Gamma', 'Alpha', 'Beta']);

    await waitFor(() => expect(shownNames()).toEqual(['Alpha', 'Beta', 'Gamma']));
    expect(await screen.findByText('Your projects changed meanwhile.')).toBeInTheDocument();
  });

  it('says how to move a row, and moves it with Alt and an arrow key', async () => {
    const reorderProjects = vi.fn(() => new Promise(() => undefined));
    await renderRows({ reorderProjects });

    expect(row('Beta')).toHaveAccessibleDescription(/Touch and hold, then drag/);
    row('Beta').focus();
    fireEvent.keyDown(row('Beta'), { key: 'ArrowUp', altKey: true });
    expect(shownNames()).toEqual(['Beta', 'Alpha', 'Gamma']);
    expect(row('Beta')).toHaveFocus();
    await waitFor(() => expect(reorderProjects).toHaveBeenCalledWith([beta, alpha, gamma]));
  });
});
