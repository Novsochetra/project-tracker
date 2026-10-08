import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dropRowOf } from '../../src/features/project/dnd/dropRow';
import { resetListView } from '../../src/features/project/listViewStore';
import { renderProject } from '../../src/features/project/test/renderProject';
import { mockPhone, skipAnimations } from '../../src/overlays/testing';
import { GAPS } from './doubleClick';

// A row's swipe actions open an action sheet from the bottom of the screen. Near the bottom bar a
// double tap on the swipe's Delete deleted the ticket, and on its Status moved the ticket to Done
// (WebKit, iPhone 13 at 375×812): the sheet slid up under the second tap 120–200 ms later, which
// pressed Delete ticket or the status row that had arrived there. jsdom has no layout, so each test
// taps the sheet's row the browser found there.

vi.mock('../../src/features/projects/ProjectOptionsButton', () => ({
  ProjectOptionsButton: () => null,
}));

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const pending = () => new Promise(() => undefined);

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations(), mockPhone(true)];
});

afterEach(() => {
  restore.reverse().forEach((undo) => undo());
  resetListView('MOB');
});

function swipeAction(key: string, label: string): HTMLElement {
  const row = dropRowOf(screen.getByRole('button', { name: new RegExp(`^${key}\\b`) }));
  if (!(row instanceof HTMLElement)) throw new Error(`No row for ${key}`);
  const action = within(row).getByText(label).closest('button');
  if (!action) throw new Error(`No ${label} action on ${key}`);
  return action;
}

async function doubleTap(label: string, sheetName: string, row: string, gap: number) {
  const user = userEvent.setup();
  await screen.findByRole('region', { name: 'To do' });
  await user.click(swipeAction('MOB-1', label));
  if (gap > 0) await wait(gap);
  const sheet = screen.getByRole('dialog', { name: sheetName });
  await user.click(within(sheet).getByRole('button', { name: row }));
  return sheet;
}

describe('regression: a double tap on a row swipe action never presses the sheet it opens', () => {
  it.each(GAPS)('Delete keeps the ticket (%i ms apart)', async (gap) => {
    const deleteTicket = vi.fn(pending);
    renderProject({ client: { deleteTicket } });
    const sheet = await doubleTap('Delete', 'Delete ticket', 'Delete ticket', gap);
    await wait(50);
    expect(deleteTicket).not.toHaveBeenCalled();
    expect(sheet).toHaveTextContent("Delete MOB-1? This can't be undone.");
    expect(screen.getByRole('button', { name: /^MOB-1\b/ })).toBeInTheDocument();
  });

  it.each(GAPS)('Status keeps the ticket where it is (%i ms apart)', async (gap) => {
    const updateTicket = vi.fn(pending);
    renderProject({ client: { updateTicket } });
    const sheet = await doubleTap('Status', 'Status', 'Done', gap);
    await wait(50);
    expect(updateTicket).not.toHaveBeenCalled();
    expect(sheet).toHaveTextContent('Move MOB-1 to');
    expect(screen.queryByText('MOB-1 moved to Done')).not.toBeInTheDocument();
  });

  it('moves the ticket on a tap once the double tap is over', async () => {
    const updateTicket = vi.fn(pending);
    renderProject({ client: { updateTicket } });
    await doubleTap('Status', 'Status', 'Done', 500);
    await waitFor(() => expect(updateTicket).toHaveBeenCalledTimes(1));
  });
});
