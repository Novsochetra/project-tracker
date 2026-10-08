import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Activity, Status } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { comment, listItem, makeTicketDetail, STATUS, statuses } from '../../../api/test/fixtures';
import { skipAnimations } from '../../../overlays/testing';
import { renderTicket, type RenderTicketOptions } from '../test/renderTicket';

const NOW = Date.now();
const CLAUDE = { kind: 'agent', name: 'Claude' } as const;
const REVIEWER = { kind: 'agent', name: 'Claude (reviewer)' } as const;

const report = comment('r1', 'TICKET: MOB-3\nSTATUS: done\nSUMMARY: Fixed the crash.', {
  type: 'report',
  actor: CLAUDE,
  createdAt: NOW - 120_000,
});
const approval = comment('v1', 'Fix is correct; the new test covers rotation.', {
  type: 'review',
  actor: REVIEWER,
  review: { verdict: 'approved', rating: 4 },
  createdAt: NOW - 60_000,
});
const sendBack = comment('v2', 'Toggle rows still use light colors.', {
  type: 'review',
  actor: REVIEWER,
  review: { verdict: 'changes_requested', rating: 2 },
  createdAt: NOW - 30_000,
});

interface SetupOptions {
  statuses?: Status[];
  phone?: boolean;
  client?: RenderTicketOptions['client'];
}

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

function setup(statusId: string, activity: Activity[], options: SetupOptions = {}) {
  const item = listItem(3, statusId, 0, { title: 'Crash on rotate', description: 'Rotate twice.' });
  const detail = makeTicketDetail(item, {
    activity,
    ...(options.statuses ? { statuses: options.statuses } : {}),
  });
  const rendered = renderTicket({
    detail,
    phone: options.phone ?? false,
    client: options.client ?? {},
  });
  cleanups.push(rendered.restorePhone);
  return rendered;
}

const latest = () => screen.getByRole('region', { name: 'Latest review' });
const log = () => screen.getByRole('region', { name: 'Activity' });
const pending = () => vi.fn().mockReturnValue(new Promise(() => undefined));
const follows = (first: Element, second: Element) =>
  (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

describe('latest review on the ticket screen', () => {
  it('shows a reviewed ticket’s latest review right under the title', () => {
    setup(STATUS.reviewed, [report, approval]);
    expect(latest()).toHaveTextContent('Claude (reviewer) reviewed');
    expect(latest()).toHaveTextContent('1m ago');
    expect(latest()).toHaveTextContent('Fix is correct; the new test covers rotation.');
    expect(within(latest()).getByRole('img', { name: 'Rated 4 out of 5' })).toBeInTheDocument();
    const reviewedColor = statuses.find((status) => status.category === 'reviewed')?.color;
    const chip = within(latest()).getByText('Approved').closest<HTMLElement>('[data-verdict]');
    expect(chip?.style.getPropertyValue('--verdict')).toBe(reviewedColor);
    expect(follows(screen.getByLabelText('Title'), latest())).toBe(true);
    expect(follows(latest(), screen.getByLabelText('Description'))).toBe(true);
    const details = screen.getByRole('complementary', { name: 'Ticket details' });
    expect(follows(latest(), details)).toBe(true);
    expect(within(log()).getByText('Fix is correct; the new test covers rotation.')).toBeVisible();
  });

  it('moves a reviewed ticket to Done with the usual toast, then focuses its status', async () => {
    const user = userEvent.setup();
    const { client } = setup(STATUS.reviewed, [approval], { client: { updateTicket: pending() } });
    await user.click(within(latest()).getByRole('button', { name: 'Move to Done' }));
    expect(client.updateTicket).toHaveBeenCalledWith('MOB-3', { statusId: STATUS.done });
    expect(await screen.findByText('MOB-3 moved to Done')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Latest review' })).not.toBeInTheDocument(),
    );
    const status = screen.getByRole('button', { name: /^Status/ });
    expect(status).toHaveTextContent('Done');
    expect(status).toHaveFocus();
  });

  it('brings the review back when the move fails', async () => {
    const updateTicket = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const user = userEvent.setup();
    setup(STATUS.reviewed, [approval], { client: { updateTicket } });
    await user.click(within(latest()).getByRole('button', { name: 'Move to Done' }));
    expect(
      await screen.findByText("Can't reach the tracker. Check your connection."),
    ).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Latest review' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Status/ })).toHaveTextContent('Reviewed');
  });

  it('names the project’s own done status', async () => {
    const user = userEvent.setup();
    const shipped = statuses.map((status) =>
      status.category === 'done' ? { ...status, name: 'Shipped' } : status,
    );
    const { client } = setup(STATUS.reviewed, [approval], {
      statuses: shipped,
      client: { updateTicket: pending() },
    });
    await user.click(within(latest()).getByRole('button', { name: 'Move to Shipped' }));
    expect(client.updateTicket).toHaveBeenCalledWith('MOB-3', { statusId: STATUS.done });
    expect(await screen.findByText('MOB-3 moved to Shipped')).toBeInTheDocument();
  });

  it('offers no Done button in a project without a done status', () => {
    setup(STATUS.reviewed, [approval], {
      statuses: statuses.filter((status) => status.category !== 'done'),
    });
    expect(latest()).toHaveTextContent('Approved');
    expect(screen.queryByRole('button', { name: /^Move to/ })).not.toBeInTheDocument();
  });

  it('shows why a sent-back ticket came back, without a Done button', () => {
    setup(STATUS.todo, [report, approval, sendBack]);
    expect(latest()).toHaveTextContent('Changes requested');
    expect(latest()).toHaveTextContent('Toggle rows still use light colors.');
    expect(latest()).not.toHaveTextContent('Approved');
    expect(within(latest()).getByRole('img', { name: 'Rated 2 out of 5' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Move to/ })).not.toBeInTheDocument();
  });

  it.each([
    ['without a review', STATUS.todo, [report]],
    ['submitted again after changes', STATUS.review, [sendBack, report]],
    ['already done', STATUS.done, [approval]],
  ])('leaves a ticket %s as it was', (_name, statusId, activity) => {
    setup(statusId, activity);
    expect(screen.queryByRole('region', { name: 'Latest review' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Move to/ })).not.toBeInTheDocument();
  });
});

describe('the phone bottom bar', () => {
  const bar = () => {
    const element = document.querySelector<HTMLElement>('[data-bottom-bar]');
    if (!element) throw new Error('No bottom bar');
    return element;
  };
  const labels = () =>
    within(bar())
      .getAllByRole('button')
      .map((button) => button.textContent);

  it('makes Move to Done the primary for a reviewed ticket', async () => {
    const user = userEvent.setup();
    const { client } = setup(STATUS.reviewed, [approval], {
      phone: true,
      client: { updateTicket: pending() },
    });
    expect(labels()).toEqual(['Paste report', 'Move to Done']);
    await user.click(within(bar()).getByRole('button', { name: 'Move to Done' }));
    expect(client.updateTicket).toHaveBeenCalledWith('MOB-3', { statusId: STATUS.done });
    expect(await screen.findByText('MOB-3 moved to Done')).toBeInTheDocument();
    await waitFor(() => expect(labels()).toEqual(['Paste report', 'Send to Claude']));
  });

  it('keeps the review on the card without its own Move to Done, and focuses the Status chip after', async () => {
    const user = userEvent.setup();
    setup(STATUS.reviewed, [approval], { phone: true, client: { updateTicket: pending() } });
    expect(latest()).toHaveTextContent('Fix is correct; the new test covers rotation.');
    expect(within(latest()).getByRole('img', { name: 'Rated 4 out of 5' })).toBeInTheDocument();
    expect(within(latest()).queryByRole('button', { name: /^Move to/ })).not.toBeInTheDocument();
    await user.click(within(bar()).getByRole('button', { name: 'Move to Done' }));
    const status = within(screen.getByRole('group', { name: 'Details' })).getByRole('button', {
      name: /^Status/,
    });
    await waitFor(() => expect(status).toHaveFocus());
    expect(status).toHaveTextContent('Done');
  });

  it('offers Move to Done for a ticket moved to Reviewed by hand', () => {
    setup(STATUS.reviewed, [], { phone: true });
    expect(labels()).toEqual(['Paste report', 'Move to Done']);
  });

  it('keeps Send to Claude for a sent-back ticket', () => {
    setup(STATUS.todo, [sendBack], { phone: true });
    expect(labels()).toEqual(['Paste report', 'Send to Claude']);
    expect(latest()).toHaveTextContent('Changes requested');
  });
});
