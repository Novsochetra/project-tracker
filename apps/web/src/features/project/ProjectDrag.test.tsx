import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STATUS } from '../../api/test/fixtures';
import { mockPhone, skipAnimations } from '../../overlays/testing';
import { dropGroupsIn } from './dnd/dropGroup';
import { dropRowsIn } from './dnd/dropRow';
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
    expect(done.querySelector('[data-edge="after"]')).not.toBeNull();
    expect(done.firstElementChild).toHaveAttribute('data-tint');

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

    fireEvent.click(rowButton('MOB-1'));
    await waitFor(() => expect(location()).toBe('/p/MOB/1'));
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
    pointer('pointercancel', 669);
    expect(moveTicket).not.toHaveBeenCalled();
    expect(screen.queryByText(/Drop here/)).not.toBeInTheDocument();
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
