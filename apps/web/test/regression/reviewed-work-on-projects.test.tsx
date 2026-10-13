import type { SessionState, TicketListItem } from '@tracker/shared';
import { act, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeClient } from '../../src/api/test/fakeClient';
import { listItem, otherProject, STATUS, statuses } from '../../src/api/test/fixtures';
import { MockEventSource } from '../../src/api/test/mockEventSource';
import { createTestQueryClient } from '../../src/api/test/render';
import { projectSummary } from '../../src/app/test/harness';
import { TrackerApp } from '../../src/app/TrackerApp';
import { mockPhone, skipAnimations } from '../../src/overlays/testing';

// Reviewed tickets sat in each project's fourth group, often behind "Show more", and Projects
// showed a bare open count, so the owner never noticed work waiting to be moved to Done.

const OPEN_SESSION: SessionState = { authRequired: false, authenticated: true };

const reviewed = (num: number): TicketListItem =>
  listItem(num, STATUS.reviewed, 0, {
    title: `Reviewed ${num}`,
    lastReview: { verdict: 'approved', rating: 4 },
  });

function renderProjects(ready: TicketListItem[]) {
  let current = ready;
  const client = fakeClient({
    getSession: vi.fn().mockResolvedValue(OPEN_SESSION),
    listProjects: vi
      .fn()
      .mockResolvedValue([projectSummary({ openCount: 4 }), projectSummary(otherProject)]),
    listAllTickets: vi.fn(() => Promise.resolve({ tickets: current, statuses })),
  });
  window.history.replaceState(null, '', '/');
  render(<TrackerApp client={client} queryClient={createTestQueryClient()} />);
  return { review: (ticket: TicketListItem) => void (current = [ticket, ...current]) };
}

const projectRow = (name: string) =>
  within(screen.getByRole('main')).getByRole('button', { name: new RegExp(`^${name} `) });

let restore: Array<() => void> = [];

beforeEach(() => {
  MockEventSource.instances = [];
  vi.stubGlobal('EventSource', MockEventSource);
  restore = [skipAnimations()];
});

afterEach(() => {
  restore.forEach((undo) => undo());
  vi.unstubAllGlobals();
});

describe('regression: reviewed work shows on Projects', () => {
  it.each([
    ['phone', true],
    ['desktop', false],
  ])('lists reviewed tickets and how many each project has (%s)', async (_size, phone) => {
    restore.push(mockPhone(phone));
    renderProjects([reviewed(3), reviewed(2)]);
    const section = await screen.findByRole('region', { name: 'Ready for you' });
    expect(within(section).getAllByRole('button', { name: /^MOB-\d\b/ })).toHaveLength(2);
    expect(within(section).getAllByRole('img', { name: 'Rated 4 out of 5' })).toHaveLength(2);
    expect(projectRow('Mobile app')).toHaveTextContent('2 ready');
    expect(projectRow('Mobile app')).toHaveTextContent('2 open');
    expect(projectRow('Website')).not.toHaveTextContent('ready');
  });

  it('shows a ticket as soon as an agent’s review arrives', async () => {
    const server = renderProjects([]);
    expect(await within(await screen.findByRole('main')).findByText('Mobile app')).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Ready for you' })).not.toBeInTheDocument();

    server.review(reviewed(5));
    act(() =>
      MockEventSource.latest().emit({ type: 'changed', projectId: 'p-mob', ticketId: 't-5' }),
    );

    const section = await screen.findByRole('region', { name: 'Ready for you' });
    expect(within(section).getByRole('button', { name: /^MOB-5\b/ })).toHaveTextContent(
      'Reviewed 5',
    );
  });
});
