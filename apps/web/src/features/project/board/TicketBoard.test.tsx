import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STATUS } from '../../../api/test/fixtures';
import { announce } from '../../../app/announce';
import { mockPhone, skipAnimations } from '../../../overlays/testing';
import { resetListView } from '../listViewStore';
import { renderProject } from '../test/renderProject';
import { setViewMode } from '../viewModeStore';

vi.mock('../../projects/ProjectOptionsButton', () => ({ ProjectOptionsButton: () => null }));

const regionNames = () =>
  screen.getAllByRole('region').map((region) => region.getAttribute('aria-label'));
const column = (name: string) => screen.getByRole('region', { name });
const header = (name: string) => within(column(name)).getByText(name).parentElement;
const viewSwitch = () => screen.getByRole('group', { name: 'Show tickets as' });
const handle = (key: string) =>
  screen.getByRole('button', { name: `Move ${key}. Drag, or use the arrow keys.` });
const cardKeys = (name: string) =>
  within(column(name))
    .queryAllByRole('button', { name: /^MOB-\d+/ })
    .map((button) => /^MOB-\d+/.exec(button.textContent ?? '')?.[0]);

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations(), mockPhone(false)];
});

afterEach(() => {
  restore.forEach((undo) => undo());
  resetListView('MOB');
  window.localStorage.clear();
  announce('');
});

describe('List / Board switch', () => {
  it('starts on the list and remembers the board for the project', async () => {
    const user = userEvent.setup();
    const first = renderProject();
    await screen.findByRole('region', { name: 'To do' });
    expect(regionNames()).toEqual(['To do', 'In progress', 'Done']);
    expect(within(viewSwitch()).getByRole('button', { name: 'List' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(within(viewSwitch()).getByRole('button', { name: 'Board' }));
    expect(regionNames()).toEqual(['To do', 'In progress', 'Need review', 'Reviewed', 'Done']);
    expect(window.localStorage.getItem('tracker.projectView.MOB')).toBe('board');

    first.view.unmount();
    renderProject();
    await screen.findByRole('region', { name: 'Need review' });
    expect(within(viewSwitch()).getByRole('button', { name: 'Board' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(within(viewSwitch()).getByRole('button', { name: 'List' }));
    expect(regionNames()).toEqual(['To do', 'In progress', 'Done']);
  });
});

describe('TicketBoard', () => {
  beforeEach(() => setViewMode('MOB', 'board'));

  it('shows a column per status in status order, with counts and empty columns', async () => {
    renderProject();
    await screen.findByRole('region', { name: 'Need review' });
    expect(regionNames()).toEqual(['To do', 'In progress', 'Need review', 'Reviewed', 'Done']);
    expect(cardKeys('To do')).toEqual(['MOB-1', 'MOB-2']);
    expect(header('To do')).toHaveTextContent('To do 2');
    expect(header('Reviewed')).toHaveTextContent('Reviewed 0');
    expect(within(column('Reviewed')).getByText('No tickets')).toBeInTheDocument();
    expect(
      within(column('Reviewed')).getByRole('button', { name: 'New ticket in Reviewed' }),
    ).toBeInTheDocument();
  });

  it("shows only the picked status's column, and narrows every column to the search", async () => {
    const user = userEvent.setup();
    renderProject();
    await screen.findByRole('region', { name: 'Need review' });
    const filters = screen.getByRole('group', { name: 'Filter tickets' });
    await user.click(within(filters).getByRole('button', { name: /^To do/ }));
    expect(regionNames()).toEqual(['To do']);
    expect(cardKeys('To do')).toEqual(['MOB-1', 'MOB-2']);
    await user.click(within(filters).getByRole('button', { name: /^Reviewed/ }));
    expect(regionNames()).toEqual(['Reviewed']);
    expect(within(column('Reviewed')).getByText('No tickets')).toBeInTheDocument();

    await user.click(within(filters).getByRole('button', { name: /^All/ }));
    await user.type(screen.getByLabelText('Search tickets'), 'mob-3');
    expect(regionNames()).toEqual(['To do', 'In progress', 'Need review', 'Reviewed', 'Done']);
    expect(cardKeys('In progress')).toEqual(['MOB-3']);
    expect(header('To do')).toHaveTextContent('To do 0');
    expect(within(column('To do')).getByText('No matches')).toBeInTheDocument();

    await user.click(within(filters).getByRole('button', { name: /^In progress/ }));
    expect(regionNames()).toEqual(['In progress']);
    expect(cardKeys('In progress')).toEqual(['MOB-3']);
  });

  it("opens New ticket preset to a column's status, and a ticket from its card", async () => {
    const user = userEvent.setup();
    const { sheets } = renderProject();
    await user.click(await screen.findByRole('button', { name: 'New ticket in Need review' }));
    expect(sheets.open).toHaveBeenCalledWith({
      type: 'newTicket',
      projectKey: 'MOB',
      statusId: STATUS.review,
    });
    await user.click(screen.getByRole('button', { name: /^MOB-3\b/ }));
    await waitFor(() =>
      expect(screen.getByRole('status', { name: 'Location' })).toHaveTextContent('/p/MOB/3'),
    );
  });

  it('moves a card to the next column with → and keeps its handle focused', async () => {
    const moveTicket = vi.fn(() => new Promise(() => undefined));
    renderProject({ client: { moveTicket } });
    await screen.findByRole('region', { name: 'Need review' });
    handle('MOB-2').focus();
    fireEvent.keyDown(handle('MOB-2'), { key: 'ArrowRight' });
    // The toast leaves after 2.2s of real time, so check it before waiting on anything.
    expect(screen.getByText('MOB-2 moved to In progress')).toBeInTheDocument();

    await waitFor(() => expect(cardKeys('In progress')).toEqual(['MOB-3', 'MOB-2']));
    expect(moveTicket).toHaveBeenCalledWith('MOB-2', {
      statusId: STATUS.progress,
      beforeId: null,
      afterId: 't-3',
    });
    expect(handle('MOB-2')).toHaveFocus();
  });

  it('moves a card back with ← into the same slot, even into an empty column', async () => {
    const user = userEvent.setup();
    const moveTicket = vi.fn(() => new Promise(() => undefined));
    renderProject({ client: { moveTicket } });
    await screen.findByRole('region', { name: 'Need review' });
    handle('MOB-4').focus();
    await user.keyboard('{ArrowLeft}');
    expect(moveTicket).toHaveBeenCalledWith('MOB-4', {
      statusId: STATUS.reviewed,
      beforeId: null,
      afterId: null,
    });
    await waitFor(() => expect(cardKeys('Reviewed')).toEqual(['MOB-4']));
    expect(handle('MOB-4')).toHaveFocus();
  });

  it('moves within a column with ↑ and ↓ and stops at the ends and the first column', async () => {
    const user = userEvent.setup();
    const moveTicket = vi.fn(() => new Promise(() => undefined));
    renderProject({ client: { moveTicket } });
    await screen.findByRole('region', { name: 'Need review' });
    handle('MOB-1').focus();
    await user.keyboard('{ArrowUp}{ArrowLeft}');
    expect(moveTicket).not.toHaveBeenCalled();

    await user.keyboard('{ArrowDown}');
    expect(moveTicket).toHaveBeenCalledWith('MOB-1', {
      statusId: STATUS.todo,
      beforeId: null,
      afterId: 't-2',
    });
    await waitFor(() => expect(cardKeys('To do')).toEqual(['MOB-2', 'MOB-1']));
    expect(document.querySelector('[aria-live="polite"]')).toHaveTextContent('MOB-1 moved');
  });
});

describe('TicketBoard on phones', () => {
  beforeEach(() => {
    restore.push(mockPhone(true));
    setViewMode('MOB', 'board');
  });

  it("gives a status tab's one column the whole width, with nothing to page to", async () => {
    const user = userEvent.setup();
    renderProject();
    await screen.findByRole('region', { name: 'Need review' });
    const board = document.querySelector('[data-board]');
    expect(document.querySelector('[data-board-pager]')).toHaveTextContent('To do 1 / 5');
    expect(board).not.toHaveAttribute('data-single');

    const filters = screen.getByRole('group', { name: 'Filter tickets' });
    await user.click(within(filters).getByRole('button', { name: /^In progress/ }));
    expect(regionNames()).toEqual(['In progress']);
    expect(document.querySelector('[data-board-pager]')).toBeNull();
    expect(board).toHaveAttribute('data-single');
  });
});
