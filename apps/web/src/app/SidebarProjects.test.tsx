import { ApiError } from '@tracker/client';
import type { ProjectSummary } from '@tracker/shared';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../api';
import { deferred } from '../api/test/deferred';
import { REORDER_ROW_ATTRIBUTE } from '../features/projects/reorder/reorderRows';
import { skipAnimations } from '../overlays/testing';
import { announce } from './announce';
import { LiveRegion } from './LiveRegion';
import { Sidebar } from './Sidebar';
import { currentPath, projectSummary, renderWithApp } from './test/harness';

const LIST_TOP = 200;
const ROW = 32;
const GAP = 2;

const projects: ProjectSummary[] = ['Alpha', 'Beta', 'Gamma'].map((name, index) =>
  projectSummary({
    id: `p-${name.toLowerCase()}`,
    name,
    key: name.slice(0, 3).toUpperCase(),
    openCount: index,
  }),
);
const [alpha, beta, gamma] = projects.map((project) => project.id);

const box = (top: number, height: number): DOMRect => ({
  x: 8,
  y: top,
  left: 8,
  top,
  width: 224,
  height,
  right: 232,
  bottom: top + height,
  toJSON: () => ({}),
});

// jsdom has no layout: the list at 200, its 32px rows 2px apart, in the order they are in now.
function layout(element: Element): DOMRect {
  const rows = [...document.querySelectorAll(`[${REORDER_ROW_ATTRIBUTE}]`)];
  const index = rows.findIndex((row) => row === element || row.contains(element));
  if (index >= 0) return box(LIST_TOP + index * (ROW + GAP), ROW);
  if (element.contains(rows[0] ?? null)) return box(LIST_TOP, rows.length * (ROW + GAP) - GAP);

  return box(0, 0);
}

const sidebar = () => screen.getByRole('complementary', { name: 'Projects' });
const shownNames = () =>
  within(sidebar())
    .getAllByRole('button')
    .filter((button) => button.hasAttribute(REORDER_ROW_ATTRIBUTE))
    .map((button) => button.textContent?.split(' ')[0]);
const item = (name: string) =>
  within(sidebar()).getByRole('button', { name: new RegExp(`^${name}`) });
const nextFrame = () => act(() => new Promise((resolve) => setTimeout(resolve, 40)));

function pointer(type: string, clientY: number) {
  act(() => {
    window.dispatchEvent(
      new PointerEvent(type, { pointerId: 1, pointerType: 'mouse', clientX: 40, clientY }),
    );
  });
}

function press(target: HTMLElement, clientY: number, pointerType = 'mouse') {
  fireEvent.pointerDown(target, {
    pointerId: 1,
    pointerType,
    button: 0,
    isPrimary: true,
    clientX: 40,
    clientY,
  });
}

let restore: Array<() => void> = [];

beforeEach(() => {
  const spy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: Element,
  ) {
    return layout(this);
  });
  restore = [skipAnimations(), () => spy.mockRestore()];
});

afterEach(() => {
  restore.forEach((undo) => undo());
  act(() => announce(''));
});

describe('reordering projects in the sidebar', () => {
  it('drags a project with transforms only, saves the order once on drop and ignores the click', async () => {
    const request = deferred<ProjectSummary[]>();
    const reorderProjects = vi.fn(() => request.promise);
    const { queryClient } = renderWithApp(<Sidebar />, { projects, client: { reorderProjects } });

    press(item('Alpha'), 216);
    pointer('pointermove', 240);
    pointer('pointermove', 300);
    await nextFrame();
    expect(document.documentElement).toHaveAttribute('data-row-drag');
    expect(item('Alpha')).toHaveAttribute('data-dragging');
    expect(item('Alpha').style.transform).toBe('translate3d(0, 60px, 0)');
    expect(item('Beta').style.transform).toBe('translate3d(0, -34px, 0)');
    expect(item('Gamma').style.transform).toBe('translate3d(0, -34px, 0)');
    // Nothing re-rendered while the pointer moved: the rows are still in their old order.
    expect(shownNames()).toEqual(['Alpha', 'Beta', 'Gamma']);

    pointer('pointerup', 300);
    fireEvent.click(item('Alpha'));
    expect(currentPath()).toBe('/');
    expect(shownNames()).toEqual(['Beta', 'Gamma', 'Alpha']);
    expect(document.documentElement).not.toHaveAttribute('data-row-drag');
    expect(item('Alpha')).not.toHaveAttribute('data-dragging');
    for (const name of ['Alpha', 'Beta', 'Gamma']) expect(item(name).style.transform).toBe('');
    await waitFor(() => expect(reorderProjects).toHaveBeenCalledWith([beta, gamma, alpha]));
    expect(reorderProjects).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(
        queryClient
          .getQueryData<ProjectSummary[]>(queryKeys.projects())
          ?.map((project) => project.name),
      ).toEqual(['Beta', 'Gamma', 'Alpha']),
    );
    request.resolve([projects[1]!, projects[2]!, projects[0]!]);
  });

  it('puts the order back and says why when saving it fails', async () => {
    const reorderProjects = vi.fn(() =>
      Promise.reject(new ApiError(409, 'conflict', 'Your projects changed meanwhile.')),
    );
    renderWithApp(<Sidebar />, {
      projects,
      client: { reorderProjects, listProjects: vi.fn().mockResolvedValue(projects) },
    });

    press(item('Gamma'), 284);
    pointer('pointermove', 210);
    await nextFrame();
    pointer('pointerup', 210);
    expect(shownNames()).toEqual(['Gamma', 'Alpha', 'Beta']);

    await waitFor(() => expect(shownNames()).toEqual(['Alpha', 'Beta', 'Gamma']));
    expect(await screen.findByText('Your projects changed meanwhile.')).toBeInTheDocument();
  });

  it('leaves the order alone for a drop in place, and for a touch, which scrolls instead', async () => {
    const reorderProjects = vi.fn();
    renderWithApp(<Sidebar />, { projects, client: { reorderProjects } });

    press(item('Beta'), 250);
    pointer('pointermove', 262);
    await nextFrame();
    pointer('pointerup', 262);
    press(item('Beta'), 250, 'touch');
    pointer('pointermove', 320);
    await nextFrame();
    pointer('pointerup', 320);

    expect(item('Beta').style.transform).toBe('');
    expect(shownNames()).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(reorderProjects).not.toHaveBeenCalled();
  });

  it('moves the focused project with Alt and an arrow key, keeping focus and saying where', async () => {
    const user = userEvent.setup();
    const reorderProjects = vi.fn(() => new Promise(() => undefined));
    renderWithApp(
      <>
        <Sidebar />
        <LiveRegion />
      </>,
      { projects, client: { reorderProjects } },
    );

    item('Beta').focus();
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}');
    expect(shownNames()).toEqual(['Beta', 'Alpha', 'Gamma']);
    expect(item('Beta')).toHaveFocus();
    await waitFor(() => expect(reorderProjects).toHaveBeenCalledWith([beta, alpha, gamma]));
    expect(screen.getByText('Beta moved to position 1 of 3')).toBeInTheDocument();

    await user.keyboard('{Alt>}{ArrowUp}{/Alt}');
    await user.keyboard('{ArrowDown}');
    expect(reorderProjects).toHaveBeenCalledTimes(1);
    expect(item('Beta')).toHaveAccessibleDescription(/Drag to change the order/);
  });

  it('still opens a project on a click', async () => {
    const user = userEvent.setup();
    renderWithApp(<Sidebar />, { projects });
    await user.click(item('Gamma'));
    expect(currentPath()).toBe('/p/GAM');
  });
});
