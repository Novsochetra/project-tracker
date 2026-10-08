import type { ProjectDetail, Review, Status, TicketListItem } from '@tracker/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listItem, otherProject, project, STATUS, statuses } from '../../api/test/fixtures';
import { currentPath, renderWithApp } from '../../app/test/harness';
import { mockPhone, skipAnimations } from '../../overlays/testing';
import { readyItems } from './readyItems';
import { ReadySection } from './ReadySection';

const APPROVED: Review = { verdict: 'approved', rating: 4 };
const webStatuses: Status[] = statuses.map((status) => ({
  ...status,
  id: `web-${status.id}`,
  projectId: otherProject.id,
  name: status.category === 'done' ? 'Shipped' : status.name,
}));

const mobTicket = (num: number, overrides: Partial<TicketListItem> = {}) =>
  listItem(num, STATUS.reviewed, num, {
    title: `Mobile ticket ${num}`,
    lastReview: APPROVED,
    ...overrides,
  });

const webTicket = (num: number, overrides: Partial<TicketListItem> = {}) =>
  mobTicket(num, {
    id: `t-web-${num}`,
    projectId: otherProject.id,
    key: `WEB-${num}`,
    statusId: 'web-s-reviewed',
    title: `Website ticket ${num}`,
    ...overrides,
  });

const details: Record<string, ProjectDetail> = {
  MOB: { project, statuses },
  WEB: { project: otherProject, statuses: webStatuses },
};

const pending = () => new Promise<never>(() => undefined);

function renderSection(tickets: TicketListItem[], client: Record<string, unknown> = {}) {
  const getProject = vi.fn((key: string) => Promise.resolve(details[key]));
  const updateTicket = vi.fn(pending);
  const view = renderWithApp(
    <ReadySection items={readyItems(tickets, [project, otherProject])} />,
    { client: { getProject, updateTicket, ...client } },
  );
  return { ...view, getProject, updateTicket };
}

const section = () => screen.getByRole('region', { name: 'Ready for you' });
const rowButton = (key: string) =>
  within(section()).getByRole('button', { name: new RegExp(`^${key}\\b`) });

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations()];
});

afterEach(() => {
  restore.forEach((undo) => undo());
});

describe('ReadySection', () => {
  it('lists each ticket with its key, title, project, verdict and rating under a counted heading', async () => {
    renderSection([webTicket(2, { lastReview: { verdict: 'approved', rating: 5 } }), mobTicket(3)]);
    expect(within(section()).getByRole('heading', { name: 'Ready for you' })).toBeInTheDocument();
    expect(section()).toHaveTextContent(/^Ready for you\s*2/);
    const web = rowButton('WEB-2');
    expect(web).toHaveTextContent('Website ticket 2');
    expect(web).toHaveTextContent('Website');
    expect(web).toHaveTextContent('Approved');
    expect(within(web).getByRole('img', { name: 'Rated 5 out of 5' })).toBeInTheDocument();
    const mobile = rowButton('MOB-3');
    expect(mobile).toHaveTextContent('Mobile app');
    expect(within(mobile).getByRole('img', { name: 'Rated 4 out of 5' })).toBeInTheDocument();
    const keys = within(section())
      .getAllByRole('button', { name: /^[A-Z]+-\d+\b/ })
      .map((button) => button.textContent?.split(' ')[0]);
    expect(keys).toEqual(['WEB-2', 'MOB-3']);
    const reviewedColor = statuses.find((status) => status.category === 'reviewed')?.color;
    await waitFor(() =>
      expect(within(mobile).getByText('Approved').style.getPropertyValue('--verdict')).toBe(
        reviewedColor,
      ),
    );
  });

  it('shows a sent-back verdict and leaves out the verdict of a ticket nobody reviewed', () => {
    renderSection([
      mobTicket(3, { lastReview: { verdict: 'changes_requested', rating: 2 } }),
      mobTicket(4, { lastReview: null }),
    ]);
    expect(rowButton('MOB-3')).toHaveTextContent('Changes requested');
    expect(within(rowButton('MOB-3')).getByRole('img', { name: 'Rated 2 out of 5' })).toBeVisible();
    expect(rowButton('MOB-4')).not.toHaveTextContent(/Approved|Changes requested/);
    expect(within(rowButton('MOB-4')).queryByRole('img')).not.toBeInTheDocument();
  });

  it('opens the ticket', async () => {
    const user = userEvent.setup();
    renderSection([webTicket(2)]);
    await user.click(rowButton('WEB-2'));
    expect(currentPath()).toBe('/p/WEB/2');
  });

  it('moves a ticket to its project’s done status with the Done button on desktop', async () => {
    const user = userEvent.setup();
    const { updateTicket } = renderSection([mobTicket(3), webTicket(2)]);
    await user.click(await screen.findByRole('button', { name: 'Move WEB-2 to Shipped' }));
    expect(updateTicket).toHaveBeenCalledWith('WEB-2', { statusId: 'web-s-done' });
    expect(await screen.findByText('WEB-2 moved to Shipped')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Move MOB-3 to Done' }));
    expect(updateTicket).toHaveBeenLastCalledWith('MOB-3', { statusId: STATUS.done });
    expect(section().querySelector('[data-swipe-row]')).toBeNull();
  });

  it('hands keyboard focus to the next ticket, or the one before, when one is moved', async () => {
    const user = userEvent.setup();
    renderSection([mobTicket(3), mobTicket(4), mobTicket(5)]);
    (await screen.findByRole('button', { name: 'Move MOB-4 to Done' })).focus();
    await user.keyboard('{Enter}');
    expect(rowButton('MOB-5')).toHaveFocus();
    screen.getByRole('button', { name: 'Move MOB-5 to Done' }).focus();
    await user.keyboard('{Enter}');
    expect(rowButton('MOB-4')).toHaveFocus();
  });

  it('offers Done only once it knows the project’s done status', async () => {
    const noDone = statuses.filter((status) => status.category !== 'done');
    const getProject = vi.fn((key: string) =>
      key === 'MOB' ? Promise.resolve({ project, statuses: noDone }) : pending(),
    );
    renderSection([mobTicket(3), webTicket(2)], { getProject });
    await waitFor(() => expect(getProject).toHaveBeenCalledWith('MOB'));
    await waitFor(() => expect(getProject).toHaveBeenCalledWith('WEB'));
    expect(screen.queryByRole('button', { name: /^Move / })).not.toBeInTheDocument();
  });

  it('shows five tickets and a Show more toggle for a long list', async () => {
    const user = userEvent.setup();
    renderSection(Array.from({ length: 7 }, (_, index) => mobTicket(index + 1)));
    expect(within(section()).getAllByRole('button', { name: /^MOB-\d+\b/ })).toHaveLength(5);
    await user.click(within(section()).getByRole('button', { name: 'Show 2 more' }));
    expect(within(section()).getAllByRole('button', { name: /^MOB-\d+\b/ })).toHaveLength(7);
    expect(within(section()).getByRole('button', { name: 'Show less' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('renders nothing when no ticket is ready', () => {
    renderSection([]);
    expect(screen.queryByRole('region', { name: 'Ready for you' })).not.toBeInTheDocument();
  });

  describe('on phones', () => {
    beforeEach(() => {
      restore.push(mockPhone(true));
    });

    // Swipe gestures need real touch input; the action they reveal is a plain button underneath.
    function swipeAction(key: string, label: string) {
      const row = rowButton(key).closest('[data-ready-row]');
      if (!(row instanceof HTMLElement)) throw new Error(`No row for ${key}`);
      const action = within(row).getByText(label).closest('button');
      if (!action) throw new Error(`No ${label} action on ${key}`);
      fireEvent.click(action);
    }

    it('swipes right to move a ticket to Done, with the usual toast', async () => {
      const { updateTicket } = renderSection([mobTicket(3)]);
      await waitFor(() =>
        expect(rowButton('MOB-3').closest('[data-ready-row]')).toHaveTextContent('Done'),
      );
      swipeAction('MOB-3', 'Done');
      await waitFor(() =>
        expect(updateTicket).toHaveBeenCalledWith('MOB-3', { statusId: STATUS.done }),
      );
      expect(await screen.findByText('MOB-3 moved to Done')).toBeInTheDocument();
    });

    it('has no Done button; the row swipes instead', async () => {
      renderSection([mobTicket(3)]);
      const row = rowButton('MOB-3').closest('[data-ready-row]');
      await waitFor(() => expect(row).toHaveTextContent('Done'));
      expect(row?.querySelector('[data-swipe-row]')).not.toBeNull();
      expect(screen.queryByRole('button', { name: 'Move MOB-3 to Done' })).not.toBeInTheDocument();
    });
  });
});
