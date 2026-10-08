import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetListView } from '../../src/features/project/listViewStore';
import { renderProject } from '../../src/features/project/test/renderProject';
import { mockPhone, skipAnimations } from '../../src/overlays/testing';

vi.mock('../../src/features/projects/ProjectOptionsButton', () => ({
  ProjectOptionsButton: () => null,
}));

// The list re-renders for a drop before the browser fires the click of the same release. The
// guard against that click lasted 400ms of wall-clock time, so a drop that took longer to
// render (a slow phone, a long list, a loaded test run) let the click open the ticket.

const row = () => screen.getByRole('button', { name: /^MOB-1\b/ });
const location = () => screen.getByRole('status', { name: 'Location' }).textContent;

function pointer(type: string, clientY: number) {
  act(() => {
    window.dispatchEvent(
      new PointerEvent(type, { pointerId: 1, pointerType: 'mouse', clientX: 100, clientY }),
    );
  });
}

function passTime(ms: number) {
  const now = performance.now.bind(performance);
  vi.spyOn(performance, 'now').mockImplementation(() => now() + ms);
}

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations(), mockPhone(false)];
});

afterEach(() => {
  vi.restoreAllMocks();
  restore.forEach((undo) => undo());
  resetListView('MOB');
});

describe('regression: the click that ends a drag never opens the ticket', () => {
  it('ignores that click however long the drop took to render', async () => {
    renderProject({ client: { moveTicket: vi.fn(() => new Promise(() => undefined)) } });
    await screen.findByRole('region', { name: 'To do' });
    fireEvent.pointerDown(row(), {
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      isPrimary: true,
      clientX: 100,
      clientY: 160,
    });
    pointer('pointermove', 170);
    pointer('pointerup', 170);
    // Rendering the drop took a second before the browser got to the click.
    passTime(1_000);
    fireEvent.click(row());
    expect(location()).toBe('/p/MOB');
  });
});
