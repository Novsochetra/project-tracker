import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STATUS } from '../../../api/test/fixtures';
import { mockPhone, skipAnimations } from '../../../overlays/testing';
import { dropRowOf, dropRowsIn } from '../dnd/dropRow';
import { resetListView } from '../listViewStore';
import { renderProject } from '../test/renderProject';
import { setViewMode } from '../viewModeStore';

vi.mock('../../projects/ProjectOptionsButton', () => ({ ProjectOptionsButton: () => null }));

interface Layout {
  board: number;
  start: number;
  width: number;
  step: number;
}

const DESKTOP: Layout = { board: 1000, start: 32, width: 260, step: 272 };
let layout = DESKTOP;

const boardElement = () => document.querySelector<HTMLElement>('[data-board]');

const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
  x: left,
  y: top,
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
  toJSON: () => ({}),
});

// jsdom has no layout: columns side by side from `start`, cards 60px tall 8px apart from y 150.
function boxOf(element: Element): DOMRect {
  const columnEl = element.closest('[data-drop-group]');
  if (!columnEl) {
    return element.matches('[data-board]') ? rect(0, 100, layout.board, 600) : rect(0, 0, 0, 0);
  }
  const columns = Array.from(document.querySelectorAll('[data-drop-group]'));
  const scrolled = boardElement()?.scrollLeft ?? 0;
  const left = layout.start + columns.indexOf(columnEl) * layout.step - scrolled;
  const card = dropRowOf(element);
  if (!card) {
    const body = element.matches('[data-column-body]');
    return body ? rect(left, 140, layout.width, 560) : rect(left, 100, layout.width, 600);
  }
  const index = dropRowsIn(columnEl).indexOf(card);
  return rect(left, 150 + index * 68, layout.width, 60);
}

const card = (key: string) => screen.getByRole('button', { name: new RegExp(`^${key}\\b`) });
const nextFrame = () => act(() => new Promise((resolve) => setTimeout(resolve, 40)));

function pointer(type: string, clientX: number, clientY: number) {
  act(() => {
    window.dispatchEvent(
      new PointerEvent(type, {
        pointerId: 1,
        pointerType: 'mouse',
        clientX,
        clientY,
        bubbles: true,
      }),
    );
  });
}

let restore: Array<() => void> = [];

beforeEach(() => {
  layout = { ...DESKTOP };
  const spy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: Element,
  ) {
    return boxOf(this);
  });
  setViewMode('MOB', 'board');
  restore = [skipAnimations(), () => spy.mockRestore()];
});

afterEach(() => {
  restore.forEach((undo) => undo());
  resetListView('MOB');
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-ticket-drag');
});

describe('dragging cards on the desktop board', () => {
  beforeEach(() => restore.push(mockPhone(false)));

  it('drops a card into the column under the pointer by x', async () => {
    const moveTicket = vi.fn(() => new Promise(() => undefined));
    renderProject({ client: { moveTicket } });
    await screen.findByRole('region', { name: 'Need review' });

    fireEvent.pointerDown(card('MOB-1'), {
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      isPrimary: true,
      clientX: 100,
      clientY: 180,
    });
    pointer('pointermove', 108, 184);
    // Need review is the third column: 576–836.
    pointer('pointermove', 650, 620);
    await nextFrame();
    const review = screen.getByRole('region', { name: 'Need review' });
    expect(review).toHaveAttribute('data-tint');
    expect(within(review).getByText('Drop here to move to Need review')).toHaveAttribute(
      'data-targeted',
    );

    pointer('pointerup', 650, 620);
    // The toast leaves after 2.2s of real time, so check it before waiting on anything.
    expect(screen.getByText('MOB-1 moved to Need review')).toBeInTheDocument();
    expect(await within(review).findByRole('button', { name: /^MOB-1\b/ })).toBeInTheDocument();
    expect(moveTicket).toHaveBeenCalledWith('MOB-1', {
      statusId: STATUS.review,
      beforeId: null,
      afterId: null,
    });
  });

  it('draws the drop line between cards by their midpoints', async () => {
    renderProject({ client: { moveTicket: vi.fn(() => new Promise(() => undefined)) } });
    await screen.findByRole('region', { name: 'Need review' });
    fireEvent.pointerDown(card('MOB-3'), {
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      isPrimary: true,
      clientX: 400,
      clientY: 180,
    });
    pointer('pointermove', 400, 190);
    // To do holds MOB-1 (150–210) and MOB-2 (218–278): just above MOB-2's middle.
    pointer('pointermove', 120, 240);
    await nextFrame();
    const todo = screen.getByRole('region', { name: 'To do' });
    expect(dropRowOf(todo.querySelector('[data-edge="before"]'))).toBe(dropRowOf(card('MOB-2')));
    pointer('pointercancel', 120, 240);
  });
});

describe('keyboard focus on the board', () => {
  beforeEach(() => restore.push(mockPhone(false)));

  it('scrolls a card cut off at the side fully into view', async () => {
    renderProject();
    await screen.findByRole('region', { name: 'Need review' });
    // Done is the fifth column, 1120–1380 on a 1000px board: it ends 16px inside the edge.
    screen.getByRole('button', { name: 'Move MOB-4. Drag, or use the arrow keys.' }).focus();
    expect(boardElement()?.scrollLeft).toBe(396);
    // To do then starts 16px inside the left edge.
    screen.getByRole('button', { name: 'Move MOB-1. Drag, or use the arrow keys.' }).focus();
    expect(boardElement()?.scrollLeft).toBe(16);
  });
});

describe('the phone board', () => {
  beforeEach(() => {
    layout = { board: 375, start: 16, width: 317, step: 333 };
    restore.push(mockPhone(true));
  });

  it('shows which column is on screen and follows swipes', async () => {
    renderProject();
    await screen.findByRole('region', { name: 'Need review' });
    const pager = document.querySelector('[data-board-pager]');
    expect(pager).toHaveTextContent('To do 1 / 5');

    const board = boardElement()!;
    act(() => {
      board.scrollLeft = 333;
      board.dispatchEvent(new Event('scroll'));
    });
    expect(pager).toHaveTextContent('In progress 2 / 5');
  });
});
