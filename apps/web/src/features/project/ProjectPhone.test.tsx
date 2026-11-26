import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Label } from '@tracker/shared';
import { makeBoard, STATUS } from '../../api/test/fixtures';
import { mockPhone, skipAnimations } from '../../overlays/testing';
import { dropRowOf } from './dnd/dropRow';
import { resetListView } from './listViewStore';
import { renderProject } from './test/renderProject';

vi.mock('../projects/ProjectOptionsButton', () => ({ ProjectOptionsButton: () => null }));

const pending = () => new Promise(() => undefined);

const label = (id: string, name: string, color: string, position: number): Label => ({
  id,
  projectId: 'p1',
  name,
  color,
  template: '',
  instructions: '',
  position,
  createdAt: 1,
});
const BUG = label('l-bug', 'Bug', '#B42318', 0);
const RELEASE = label('l-rel', 'v1.4', '#3E63DD', 1);
const rowOf = (key: string) =>
  dropRowOf(screen.getByRole('button', { name: new RegExp(`^${key}\\b`) }));

// Swipe gestures need real touch input; the actions they reveal are plain buttons underneath.
function swipeAction(key: string, label: string) {
  const row = rowOf(key);
  if (!(row instanceof HTMLElement)) throw new Error(`No row for ${key}`);
  const action = within(row).getByText(label).closest('button');
  if (!action) throw new Error(`No ${label} action on ${key}`);
  fireEvent.click(action);
}

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations(), mockPhone(true)];
});

afterEach(() => {
  restore.forEach((undo) => undo());
  resetListView('MOB');
});

describe('ProjectScreen on phones', () => {
  it('shows the nav bar and New ticket in the bottom bar, within reach of a thumb', async () => {
    const user = userEvent.setup();
    const { sheets } = renderProject();
    await screen.findByRole('region', { name: 'To do' });
    expect(screen.getByRole('button', { name: 'Back to Projects' })).toBeInTheDocument();
    const newTicket = screen.getByRole('button', { name: 'New ticket' });
    expect(newTicket.closest('[data-bottom-bar]')).not.toBeNull();
    await user.click(newTicket);
    expect(sheets.open).toHaveBeenCalledWith({ type: 'newTicket', projectKey: 'MOB' });
  });

  it('swipes right to move a ticket to the next status', async () => {
    const updateTicket = vi.fn(pending);
    renderProject({ client: { updateTicket } });
    await screen.findByRole('region', { name: 'To do' });
    swipeAction('MOB-1', 'In progress');
    // The toast leaves after 2.2s of real time, so check it before waiting on anything.
    expect(screen.getByText('MOB-1 moved to In progress')).toBeInTheDocument();
    await waitFor(() =>
      expect(updateTicket).toHaveBeenCalledWith('MOB-1', { statusId: STATUS.progress }),
    );
    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'In progress' })).toHaveTextContent('MOB-1'),
    );
  });

  it('has no swipe-right action on the last status', async () => {
    renderProject();
    await screen.findByRole('region', { name: 'Done' });
    const row = rowOf('MOB-4');
    // The handle, the row, and Status, Labels and Delete.
    expect(row?.querySelectorAll('button')).toHaveLength(5);
  });

  it('swipes left to pick another status from an action sheet', async () => {
    const updateTicket = vi.fn(pending);
    renderProject({ client: { updateTicket } });
    await screen.findByRole('region', { name: 'To do' });
    swipeAction('MOB-1', 'Status');
    const sheet = await screen.findByRole('dialog', { name: 'Status' });
    expect(sheet).toHaveTextContent('Move MOB-1 to');
    expect(within(sheet).queryByRole('button', { name: 'To do' })).not.toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Done' }));
    // The toast leaves after 2.2s of real time, so check it before waiting on anything.
    expect(screen.getByText('MOB-1 moved to Done')).toBeInTheDocument();
    await waitFor(() =>
      expect(updateTicket).toHaveBeenCalledWith('MOB-1', { statusId: STATUS.done }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('swipes left to label a ticket from a sheet of chips, without opening it', async () => {
    const user = userEvent.setup();
    const updateTicket = vi.fn(pending);
    const board = { ...makeBoard(), labels: [BUG, RELEASE] };
    renderProject({ board, client: { updateTicket } });
    await screen.findByRole('region', { name: 'To do' });
    swipeAction('MOB-1', 'Labels');
    const sheet = await screen.findByRole('dialog', { name: 'Pick labels' });
    expect(sheet).toHaveTextContent('MOB-1');
    await user.click(within(sheet).getByRole('option', { name: 'v1.4' }));
    expect(updateTicket).toHaveBeenLastCalledWith('MOB-1', { labelIds: ['l-rel'] });
    expect(within(sheet).getByRole('option', { name: 'v1.4' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await user.click(within(sheet).getByRole('option', { name: 'Bug' }));
    expect(updateTicket).toHaveBeenLastCalledWith('MOB-1', { labelIds: ['l-rel', 'l-bug'] });
    expect(screen.getByRole('button', { name: /^MOB-1\b/ })).toHaveAccessibleName(/Bug.*v1\.4/);
    await user.click(within(sheet).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('swipes left to delete after confirming', async () => {
    const deleteTicket = vi.fn(pending);
    renderProject({ client: { deleteTicket } });
    await screen.findByRole('region', { name: 'To do' });
    swipeAction('MOB-2', 'Delete');
    const sheet = await screen.findByRole('dialog', { name: 'Delete ticket' });
    expect(sheet).toHaveTextContent("Delete MOB-2? This can't be undone.");
    fireEvent.click(within(sheet).getByRole('button', { name: 'Delete ticket' }));
    // The toast leaves after 2.2s of real time, so check it before waiting on anything.
    expect(screen.getByText('MOB-2 deleted')).toBeInTheDocument();
    await waitFor(() => expect(deleteTicket).toHaveBeenCalledWith('MOB-2'));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /^MOB-2\b/ })).not.toBeInTheDocument(),
    );
  });

  it('cancels a delete without touching the ticket', async () => {
    const user = userEvent.setup();
    const deleteTicket = vi.fn();
    renderProject({ client: { deleteTicket } });
    await screen.findByRole('region', { name: 'To do' });
    swipeAction('MOB-2', 'Delete');
    const sheet = await screen.findByRole('dialog', { name: 'Delete ticket' });
    await user.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    expect(deleteTicket).not.toHaveBeenCalled();
  });
});
