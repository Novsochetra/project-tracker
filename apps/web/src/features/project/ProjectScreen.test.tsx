import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@tracker/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listItem, makeBoard, STATUS } from '../../api/test/fixtures';
import { mockPhone, skipAnimations } from '../../overlays/testing';
import { announce } from '../../app/announce';
import { resetListView, setListFilter } from './listViewStore';
import { renderProject } from './test/renderProject';

vi.mock('../projects/ProjectOptionsButton', () => ({ ProjectOptionsButton: () => null }));

const group = (name: string) => screen.getByRole('region', { name });
const rowButtons = (region: HTMLElement) =>
  within(region).getAllByRole('button', { name: /^MOB-\d+/ });
const rowKeys = (region: HTMLElement) =>
  rowButtons(region).map((button) => /^MOB-\d+/.exec(button.textContent ?? '')?.[0]);
const filters = () => screen.getByRole('group', { name: 'Filter tickets' });
const location = () => screen.getByRole('status', { name: 'Location' }).textContent;
const liveRegion = () => document.querySelector('[aria-live="polite"]');

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations(), mockPhone(false)];
});

afterEach(() => {
  restore.forEach((undo) => undo());
  resetListView('MOB');
  announce('');
});

describe('ProjectScreen', () => {
  it('shows a group per status with tickets, in status order, rows by rank', async () => {
    renderProject();
    await screen.findByRole('region', { name: 'To do' });
    const names = screen.getAllByRole('region').map((region) => region.getAttribute('aria-label'));
    expect(names).toEqual(['To do', 'In progress', 'Done']);
    expect(rowKeys(group('To do'))).toEqual(['MOB-1', 'MOB-2']);
    expect(within(group('To do')).getByText('2')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Move MOB-1. Drag, or use the arrow keys.' }),
    ).toBeInTheDocument();
  });

  it('counts the whole project and searches titles and keys', async () => {
    const user = userEvent.setup();
    renderProject();
    await screen.findByRole('region', { name: 'To do' });
    expect(within(filters()).getByRole('button', { name: 'All 4' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(filters()).getByRole('button', { name: 'Active 3' })).toBeInTheDocument();
    expect(within(filters()).getByRole('button', { name: 'Done 1' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Search tickets'), 'mob-3');
    expect(
      screen.getAllByRole('region').map((region) => region.getAttribute('aria-label')),
    ).toEqual(['In progress']);
    expect(within(filters()).getByRole('button', { name: 'All 4' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Search tickets'), 'zzz');
    expect(screen.getByText('No tickets match.')).toBeInTheDocument();
  });

  it('shows open groups for Active and done groups for Done', async () => {
    const user = userEvent.setup();
    renderProject();
    await screen.findByRole('region', { name: 'To do' });
    await user.click(within(filters()).getByRole('button', { name: /^Active/ }));
    expect(screen.queryByRole('region', { name: 'Done' })).not.toBeInTheDocument();
    await user.click(within(filters()).getByRole('button', { name: /^Done/ }));
    expect(screen.queryByRole('region', { name: 'To do' })).not.toBeInTheDocument();
    expect(group('Done')).toBeInTheDocument();
  });

  it('collapses groups of more than six to five rows with Show more', async () => {
    const user = userEvent.setup();
    const tickets = Array.from({ length: 7 }, (_, index) =>
      listItem(index + 1, STATUS.todo, index * 1000),
    );
    renderProject({ board: makeBoard(tickets) });
    const todo = await screen.findByRole('region', { name: 'To do' });
    expect(rowButtons(todo)).toHaveLength(5);
    const more = within(todo).getByRole('button', { name: 'Show 2 more' });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    await user.click(more);
    expect(rowButtons(todo)).toHaveLength(7);
    expect(within(todo).getByRole('button', { name: 'Show less' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await user.click(within(todo).getByRole('button', { name: 'Show less' }));
  });

  it('offers the first ticket on an empty project', async () => {
    const user = userEvent.setup();
    const { sheets } = renderProject({ board: makeBoard([]) });
    expect(await screen.findByText('No tickets yet')).toBeInTheDocument();
    expect(screen.getByText('Create the first ticket for Mobile app.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'New ticket' }));
    expect(sheets.open).toHaveBeenCalledWith({
      type: 'newTicket',
      projectKey: 'MOB',
      statusId: undefined,
    });
  });

  it("opens New ticket preset to a group's status", async () => {
    const user = userEvent.setup();
    const { sheets } = renderProject();
    await user.click(await screen.findByRole('button', { name: 'New ticket in In progress' }));
    expect(sheets.open).toHaveBeenCalledWith({
      type: 'newTicket',
      projectKey: 'MOB',
      statusId: STATUS.progress,
    });
  });

  it('opens the ticket when a row is clicked', async () => {
    const user = userEvent.setup();
    renderProject();
    await user.click(await screen.findByRole('button', { name: /^MOB-3\b/ }));
    await waitFor(() => expect(location()).toBe('/p/MOB/3'));
  });

  it('moves a ticket across groups with the arrow keys and keeps the handle focused', async () => {
    const moveTicket = vi.fn(() => new Promise(() => undefined));
    renderProject({ client: { moveTicket } });
    const handleName = 'Move MOB-2. Drag, or use the arrow keys.';
    const handle = await screen.findByRole('button', { name: handleName });
    handle.focus();
    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    // The toast leaves after 2.2s of real time, so check it before waiting on anything.
    expect(screen.getByText('MOB-2 moved to In progress')).toBeInTheDocument();

    await waitFor(() => expect(rowKeys(group('In progress'))).toEqual(['MOB-2', 'MOB-3']));
    expect(moveTicket).toHaveBeenCalledWith('MOB-2', {
      statusId: STATUS.progress,
      beforeId: 't-3',
      afterId: null,
    });
    expect(screen.getByRole('button', { name: handleName })).toHaveFocus();
    // Announced once, by the toast's status region; the hidden live region stays quiet.
    expect(liveRegion()).toBeEmptyDOMElement();
  });

  it('reorders within a group with the arrow keys', async () => {
    const user = userEvent.setup();
    const moveTicket = vi.fn(() => new Promise(() => undefined));
    renderProject({ client: { moveTicket } });
    (
      await screen.findByRole('button', { name: 'Move MOB-1. Drag, or use the arrow keys.' })
    ).focus();
    await user.keyboard('{ArrowDown}');
    expect(moveTicket).toHaveBeenCalledWith('MOB-1', {
      statusId: STATUS.todo,
      beforeId: null,
      afterId: 't-2',
    });
    await waitFor(() => expect(rowKeys(group('To do'))).toEqual(['MOB-2', 'MOB-1']));
    expect(
      screen.getByRole('button', { name: 'Move MOB-1. Drag, or use the arrow keys.' }),
    ).toHaveFocus();
    expect(liveRegion()).toHaveTextContent('MOB-1 moved');
    expect(screen.queryByText('MOB-1 moved', { selector: 'span' })).not.toBeInTheDocument();
  });

  it('does nothing at the edge of the last visible group', async () => {
    const user = userEvent.setup();
    const moveTicket = vi.fn();
    renderProject({ client: { moveTicket } });
    (
      await screen.findByRole('button', { name: 'Move MOB-4. Drag, or use the arrow keys.' })
    ).focus();
    await user.keyboard('{ArrowDown}');
    expect(moveTicket).not.toHaveBeenCalled();
  });

  it('goes back to Projects when the project does not exist', async () => {
    const getBoard = vi.fn().mockRejectedValue(new ApiError(404, 'not_found', 'No project NOPE'));
    renderProject({ path: '/p/NOPE', client: { getBoard } });
    await waitFor(() => expect(location()).toBe('/'));
  });

  it('opens on All with an empty search', async () => {
    setListFilter('MOB', 'done');
    renderProject();
    await screen.findByRole('region', { name: 'To do' });
    expect(within(filters()).getByRole('button', { name: /^All/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('shows the repository and the Claude Code actions on desktop', async () => {
    const user = userEvent.setup();
    const { sheets } = renderProject();
    expect(await screen.findByText('~/code/mobile-app')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send open tickets to Claude Code' }));
    expect(sheets.open).toHaveBeenCalledWith({
      type: 'prompt',
      scope: { kind: 'project', projectKey: 'MOB' },
    });
    await user.click(screen.getByRole('button', { name: 'Paste report' }));
    expect(sheets.open).toHaveBeenCalledWith({
      type: 'report',
      scope: { kind: 'project', projectKey: 'MOB' },
    });
  });

  it('shows an error with a retry when the board fails to load', async () => {
    const user = userEvent.setup();
    const getBoard = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(500, 'internal', 'Database is locked.'))
      .mockResolvedValue(makeBoard());
    renderProject({ client: { getBoard } });
    expect(await screen.findByText('Database is locked.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('region', { name: 'To do' })).toBeInTheDocument();
  });
});
