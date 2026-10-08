import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@tracker/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../../api';
import { listItem, makeBoard, STATUS, statuses } from '../../api/test/fixtures';
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
const filters = () => screen.getByRole('toolbar', { name: 'Filter tickets' });
const tabNames = () =>
  within(filters())
    .getAllByRole('button')
    .map((button) => button.textContent);
const regionNames = () =>
  screen.getAllByRole('region').map((region) => region.getAttribute('aria-label'));
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
    expect(tabNames()).toEqual([
      'All 4 tickets',
      'To do 2 tickets',
      'In progress 1 ticket',
      'Need review 0 tickets',
      'Reviewed 0 tickets',
      'Done 1 ticket',
    ]);
    expect(within(filters()).getByRole('button', { name: 'All 4 tickets' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.type(screen.getByLabelText('Search tickets'), 'mob-3');
    expect(regionNames()).toEqual(['In progress']);
    expect(within(filters()).getByRole('button', { name: 'All 4 tickets' })).toBeInTheDocument();
    expect(within(filters()).getByRole('button', { name: 'To do 2 tickets' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Search tickets'), 'zzz');
    expect(screen.getByText('No tickets match.')).toBeInTheDocument();
  });

  it("shows only the picked status's group, and every group again on All", async () => {
    const user = userEvent.setup();
    renderProject();
    await screen.findByRole('region', { name: 'To do' });
    await user.click(within(filters()).getByRole('button', { name: /^Done/ }));
    expect(regionNames()).toEqual(['Done']);
    await user.click(within(filters()).getByRole('button', { name: /^To do/ }));
    expect(regionNames()).toEqual(['To do']);
    expect(rowKeys(group('To do'))).toEqual(['MOB-1', 'MOB-2']);

    await user.click(within(filters()).getByRole('button', { name: /^Need review/ }));
    expect(screen.queryAllByRole('region')).toEqual([]);
    expect(screen.getByText('No tickets in Need review')).toBeInTheDocument();

    await user.click(within(filters()).getByRole('button', { name: /^All/ }));
    expect(regionNames()).toEqual(['To do', 'In progress', 'Done']);
  });

  it('combines the status tab with the search', async () => {
    const user = userEvent.setup();
    renderProject();
    await screen.findByRole('region', { name: 'To do' });
    await user.click(within(filters()).getByRole('button', { name: /^To do/ }));
    await user.type(screen.getByLabelText('Search tickets'), 'mob-2');
    expect(regionNames()).toEqual(['To do']);
    expect(rowKeys(group('To do'))).toEqual(['MOB-2']);
    await user.clear(screen.getByLabelText('Search tickets'));
    await user.type(screen.getByLabelText('Search tickets'), 'mob-3');
    expect(screen.getByText('No tickets match.')).toBeInTheDocument();
  });

  it('replays the rise of the groups when the tab changes', async () => {
    const user = userEvent.setup();
    renderProject();
    const todo = await screen.findByRole('region', { name: 'To do' });
    const before = todo.getAttribute('data-rise');
    await user.click(within(filters()).getByRole('button', { name: /^To do/ }));
    expect(group('To do')).toBe(todo);
    expect(todo.getAttribute('data-rise')).not.toBe(before);
    const picked = todo.getAttribute('data-rise');
    await user.click(within(filters()).getByRole('button', { name: /^All/ }));
    expect(todo.getAttribute('data-rise')).not.toBe(picked);
  });

  it('keeps the tabs in step with the statuses: renamed, added, reordered, deleted', async () => {
    const user = userEvent.setup();
    const { queryClient } = renderProject();
    await screen.findByRole('region', { name: 'To do' });
    await user.click(within(filters()).getByRole('button', { name: /^In progress/ }));
    const setStatuses = (next: typeof statuses) =>
      act(() => {
        queryClient.setQueryData(queryKeys.board('MOB'), { ...makeBoard(), statuses: next });
      });
    const pressed = (name: RegExp) =>
      expect(within(filters()).getByRole('button', { name })).toHaveAttribute(
        'aria-pressed',
        'true',
      );

    const blocked = { ...statuses[1]!, id: 's-blocked', name: 'Blocked', position: 2.5 };
    setStatuses([
      ...statuses.map((s) => (s.id === STATUS.todo ? { ...s, name: 'Backlog' } : s)),
      blocked,
    ]);
    await waitFor(() =>
      expect(tabNames()).toEqual([
        'All 4 tickets',
        'Backlog 2 tickets',
        'In progress 1 ticket',
        'Need review 0 tickets',
        'Blocked 0 tickets',
        'Reviewed 0 tickets',
        'Done 1 ticket',
      ]),
    );

    setStatuses(statuses.map((s) => (s.id === STATUS.done ? { ...s, position: -1 } : s)));
    await waitFor(() => expect(tabNames()[1]).toBe('Done 1 ticket'));
    pressed(/^In progress/);
    expect(regionNames()).toEqual(['In progress']);

    setStatuses(statuses.filter((s) => s.id !== STATUS.progress));
    await waitFor(() => expect(tabNames()).not.toContain('In progress 1 ticket'));
    pressed(/^All/);
    expect(regionNames()).toEqual(['To do', 'Done']);
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
    setListFilter('MOB', STATUS.done);
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
