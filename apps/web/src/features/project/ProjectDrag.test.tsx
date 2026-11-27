import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STATUS } from '../../api/test/fixtures';
import { mockPhone, skipAnimations } from '../../overlays/testing';
import { dropGroupsIn } from './dnd/dropGroup';
import { DROP_ROW_ATTRIBUTE, dropRowsIn } from './dnd/dropRow';
import { GROUP_END_ATTRIBUTE } from './dnd/listRows';
import { resetListView } from './listViewStore';
import { renderProject } from './test/renderProject';

vi.mock('../projects/ProjectOptionsButton', () => ({ ProjectOptionsButton: () => null }));

const HEADER = 41;
const ROW = 44;
const ZONE = 64;
const GAP = 16;

const box = (top: number, height: number): DOMRect => ({
  x: 16,
  y: top,
  left: 16,
  top,
  width: 600,
  height,
  right: 616,
  bottom: top + height,
  toJSON: () => ({}),
});

// jsdom has no layout: stack the groups like the real list, header then 44px rows (or a zone).
function layout(): Map<Element, DOMRect> {
  const rects = new Map<Element, DOMRect>();
  let y = 100;
  for (const section of dropGroupsIn(document)) {
    const top = y;
    y += HEADER;
    const rows = dropRowsIn(section);
    for (const row of rows) {
      rects.set(row, box(y, ROW));
      row.querySelectorAll('*').forEach((child) => rects.set(child, box(y, ROW)));
      y += ROW;
    }

    if (rows.length === 0) y += ZONE;
    rects.set(section, box(top, y - top));
    y += GAP;
  }

  return rects;
}

const rowOf = (id: string) =>
  document.querySelector<HTMLElement>(`[${DROP_ROW_ATTRIBUTE}="${id}"]`);
const endOf = (statusId: string) =>
  document.querySelector<HTMLElement>(`[${GROUP_END_ATTRIBUTE}="${statusId}"]`);
const rowButton = (key: string) => screen.getByRole('button', { name: new RegExp(`^${key}\\b`) });
const location = () => screen.getByRole('status', { name: 'Location' }).textContent;
const nextFrame = () => act(() => new Promise((resolve) => setTimeout(resolve, 40)));

function pointer(type: string, clientY: number, pointerType = 'mouse') {
  act(() => {
    window.dispatchEvent(
      new PointerEvent(type, { pointerId: 1, pointerType, clientX: 100, clientY, bubbles: true }),
    );
  });
}

function press(target: HTMLElement, clientY: number, pointerType = 'mouse') {
  fireEvent.pointerDown(target, {
    pointerId: 1,
    pointerType,
    button: 0,
    isPrimary: true,
    clientX: 100,
    clientY,
  });
}

let restore: Array<() => void> = [];

beforeEach(() => {
  const spy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: Element,
  ) {
    return layout().get(this) ?? box(0, 0);
  });
  restore = [skipAnimations(), mockPhone(false), () => spy.mockRestore()];
});

afterEach(() => {
  restore.forEach((undo) => undo());
  resetListView('MOB');
  document.documentElement.removeAttribute('data-ticket-drag');
});

describe('dragging tickets', () => {
  it('drags a row into another group, then ignores the click that follows', async () => {
    const moveTicket = vi.fn(() => new Promise(() => undefined));
    renderProject({ client: { moveTicket } });
    await screen.findByRole('region', { name: 'To do' });

    press(rowButton('MOB-1'), 160);
    pointer('pointermove', 170);
    expect(document.documentElement).toHaveAttribute('data-ticket-drag');
    expect(screen.getByRole('region', { name: 'Need review' })).toHaveTextContent(
      'Drop here to move to Need review',
    );
    // Done now sits below two empty groups: 588 + header, MOB-4 at 629–673.
    pointer('pointermove', 669);
    await nextFrame();
    const done = screen.getByRole('region', { name: 'Done' });
    expect(done.firstElementChild).toHaveAttribute('data-tint');
    // The ghost is the ticket: its row folds away from To do, and Done grows a slot after MOB-4.
    expect(rowOf('t-1')).toHaveAttribute('data-drag-source');
    expect(rowOf('t-1')).toHaveAttribute('data-drag-away');
    expect(rowOf('t-1')?.style.height).toBe('0px');
    expect(rowOf('t-4')?.style.transform).toBe('');
    expect(endOf(STATUS.done)?.style.paddingTop).toBe('44px');

    pointer('pointerup', 669);
    // The browser clicks the pressed row in the same task as the release; that click must not
    // open it, however long the drop took to render.
    fireEvent.click(rowButton('MOB-1'));
    expect(location()).toBe('/p/MOB');
    // The toast leaves after 2.2s of real time, so check it before waiting on anything.
    expect(screen.getByText('MOB-1 moved to Done')).toBeInTheDocument();
    expect(document.documentElement).not.toHaveAttribute('data-ticket-drag');
    await waitFor(() =>
      expect(moveTicket).toHaveBeenCalledWith('MOB-1', {
        statusId: STATUS.done,
        beforeId: null,
        afterId: 't-4',
      }),
    );
    await waitFor(() =>
      expect(
        within(screen.getByRole('region', { name: 'Done' })).getByText('Ticket 1'),
      ).toBeTruthy(),
    );
    expect(endOf(STATUS.done)?.style.paddingTop).toBe('');
    expect(rowOf('t-1')?.style.height).toBe('');
    expect(rowOf('t-1')).not.toHaveAttribute('data-drag-away');

    fireEvent.click(rowButton('MOB-1'));
    await waitFor(() => expect(location()).toBe('/p/MOB/1'));
  });

  it('slides the rows aside within a group, and lets go of them once the move shows', async () => {
    const moveTicket = vi.fn(() => new Promise(() => undefined));
    renderProject({ client: { moveTicket } });
    await screen.findByRole('region', { name: 'To do' });

    // MOB-1 is at 141–185, MOB-2 at 185–229: above MOB-1's middle MOB-2 goes first.
    press(rowButton('MOB-2'), 200);
    pointer('pointermove', 210);
    pointer('pointermove', 150);
    await nextFrame();
    expect(rowOf('t-1')?.style.transform).toBe('translate3d(0, 44px, 0)');
    expect(rowOf('t-2')).not.toHaveAttribute('data-drag-away');
    expect(endOf(STATUS.todo)?.style.paddingTop).toBe('');

    // Back below it, MOB-1 slides back.
    pointer('pointermove', 200);
    await nextFrame();
    expect(rowOf('t-1')?.style.transform).toBe('');

    pointer('pointermove', 150);
    await nextFrame();
    pointer('pointerup', 150);
    await waitFor(() =>
      expect(moveTicket).toHaveBeenCalledWith('MOB-2', {
        statusId: STATUS.todo,
        beforeId: 't-1',
        afterId: null,
      }),
    );
    const todo = screen.getByRole('region', { name: 'To do' });
    await waitFor(() =>
      expect(within(todo).getAllByRole('button', { name: /^MOB-\d/ })[0]).toHaveAccessibleName(
        /^MOB-2\b/,
      ),
    );
    expect(rowOf('t-1')?.style.transform).toBe('');
    expect(rowOf('t-2')).not.toHaveAttribute('data-drag-source');
    expect(rowOf('t-2')?.style.height).toBe('');
  });

  it('drops where the gap shows, though the group it entered moved under a still pointer', async () => {
    const moveTicket = vi.fn(() => new Promise(() => undefined));
    renderProject({ client: { moveTicket } });
    await screen.findByRole('region', { name: 'To do' });

    // MOB-4 sits at 629–673: above its middle the gap opens before it. MOB-1 folding away then
    // moves Done up 44px, which would put a fresh read below MOB-4's middle.
    press(rowButton('MOB-1'), 160);
    pointer('pointermove', 170);
    pointer('pointermove', 639);
    await nextFrame();
    expect(rowOf('t-4')?.style.transform).toBe('translate3d(0, 44px, 0)');

    pointer('pointerup', 639);
    await waitFor(() =>
      expect(moveTicket).toHaveBeenCalledWith('MOB-1', {
        statusId: STATUS.done,
        beforeId: 't-4',
        afterId: null,
      }),
    );
  });

  it('marks the empty group a ticket would drop into', async () => {
    renderProject({ client: { moveTicket: vi.fn(() => new Promise(() => undefined)) } });
    await screen.findByRole('region', { name: 'To do' });
    press(rowButton('MOB-3'), 300);
    pointer('pointermove', 320);
    // Need review: 346–451, its zone below the header.
    pointer('pointermove', 420);
    await nextFrame();
    const zone = screen.getByText('Drop here to move to Need review');
    expect(zone).toHaveAttribute('data-targeted');
    pointer('pointerup', 420);
  });

  it('does nothing when dropped back where it was', async () => {
    const moveTicket = vi.fn();
    renderProject({ client: { moveTicket } });
    await screen.findByRole('region', { name: 'To do' });
    press(rowButton('MOB-1'), 160);
    pointer('pointermove', 168);
    pointer('pointerup', 168);
    expect(moveTicket).not.toHaveBeenCalled();
  });

  it('drops nothing when the pointer is cancelled', async () => {
    const moveTicket = vi.fn();
    renderProject({ client: { moveTicket } });
    await screen.findByRole('region', { name: 'To do' });
    press(rowButton('MOB-1'), 160);
    pointer('pointermove', 669);
    await nextFrame();
    expect(endOf(STATUS.done)?.style.paddingTop).toBe('44px');
    pointer('pointercancel', 669);
    expect(moveTicket).not.toHaveBeenCalled();
    expect(screen.queryByText(/Drop here/)).not.toBeInTheDocument();
    expect(endOf(STATUS.done)?.style.paddingTop).toBe('');
    expect(rowOf('t-1')).not.toHaveAttribute('data-drag-source');
    expect(rowOf('t-1')).not.toHaveAttribute('data-drag-away');
    expect(rowOf('t-1')?.style.height).toBe('');
  });

  it('drags touches only from the handle, starting at once', async () => {
    renderProject();
    await screen.findByRole('region', { name: 'To do' });
    press(rowButton('MOB-1'), 160, 'touch');
    expect(document.documentElement).not.toHaveAttribute('data-ticket-drag');
    pointer('pointerup', 160, 'touch');

    press(
      screen.getByRole('button', { name: 'Move MOB-1. Drag, or use the arrow keys.' }),
      160,
      'touch',
    );
    expect(document.documentElement).toHaveAttribute('data-ticket-drag');
    expect(screen.getByText('Drop here to move to Need review')).toBeInTheDocument();
    pointer('pointercancel', 160, 'touch');
  });
});
