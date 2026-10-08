import type { SessionState, Status, TicketListItem } from '@tracker/shared';
import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeClient } from '../../src/api/test/fakeClient';
import { listItem, otherProject, STATUS, statuses } from '../../src/api/test/fixtures';
import { MockEventSource } from '../../src/api/test/mockEventSource';
import { createTestQueryClient } from '../../src/api/test/render';
import { projectSummary } from '../../src/app/test/harness';
import { TrackerApp } from '../../src/app/TrackerApp';
import { mockPhone, skipAnimations } from '../../src/overlays/testing';

// Each Ready for you row asked for its project (GET /api/projects/:key) only to learn the done
// status and the Reviewed color: one request per project, and no swipe or Done until it answered.

const OPEN_SESSION: SessionState = { authRequired: false, authenticated: true };
const TEAL = '#12A594';

const webStatuses: Status[] = statuses.map((status) => ({
  ...status,
  id: `web-${status.id}`,
  projectId: otherProject.id,
  name: status.category === 'done' ? 'Shipped' : status.name,
  color: status.category === 'reviewed' ? TEAL : status.color,
}));

const reviewed = (num: number, overrides: Partial<TicketListItem> = {}): TicketListItem =>
  listItem(num, STATUS.reviewed, 0, {
    lastReview: { verdict: 'approved', rating: 4 },
    ...overrides,
  });

const READY = [
  reviewed(2, {
    id: 't-web-2',
    projectId: otherProject.id,
    key: 'WEB-2',
    statusId: 'web-s-reviewed',
  }),
  reviewed(3),
];

function renderProjects() {
  const client = fakeClient({
    getSession: vi.fn().mockResolvedValue(OPEN_SESSION),
    listProjects: vi.fn().mockResolvedValue([projectSummary(), projectSummary(otherProject)]),
    listAllTickets: vi
      .fn()
      .mockResolvedValue({ tickets: READY, statuses: [...statuses, ...webStatuses] }),
    getProject: vi.fn(() => new Promise(() => undefined)),
  });
  window.history.replaceState(null, '', '/');
  render(<TrackerApp client={client} queryClient={createTestQueryClient()} />);
  return client;
}

const readyRow = (section: HTMLElement, key: string) => {
  const row = within(section)
    .getByRole('button', { name: new RegExp(`^${key}\\b`) })
    .closest<HTMLElement>('[data-ready-row]');
  if (!row) throw new Error(`No ready row for ${key}`);
  return row;
};

const chipColor = (row: HTMLElement) =>
  within(row)
    .getByText('Approved')
    .closest<HTMLElement>('[data-verdict]')
    ?.style.getPropertyValue('--verdict');

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

describe('regression: Ready for you reads its rows in one request', () => {
  it('offers Done on every row as soon as the rows show, without asking for the projects', async () => {
    restore.push(mockPhone(false));
    const client = renderProjects();

    const section = await screen.findByRole('region', { name: 'Ready for you' });

    expect(within(section).getByRole('button', { name: 'Move WEB-2 to Shipped' })).toBeVisible();
    expect(within(section).getByRole('button', { name: 'Move MOB-3 to Done' })).toBeVisible();
    expect(chipColor(readyRow(section, 'WEB-2'))).toBe(TEAL);
    expect(client.getProject).not.toHaveBeenCalled();
    expect(client.listAllTickets).toHaveBeenCalledTimes(1);
  });

  it('lets a phone swipe every row to its done status as soon as the rows show', async () => {
    restore.push(mockPhone(true));
    const client = renderProjects();

    const section = await screen.findByRole('region', { name: 'Ready for you' });

    expect(readyRow(section, 'WEB-2')).toHaveTextContent('Shipped');
    expect(readyRow(section, 'MOB-3')).toHaveTextContent('Done');
    expect(client.getProject).not.toHaveBeenCalled();
    expect(client.listAllTickets).toHaveBeenCalledTimes(1);
  });
});
