import type { SessionState } from '@tracker/shared';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeClient } from '../api/test/fakeClient';
import { listItem, makeBoard, makeTicketDetail, STATUS, statuses } from '../api/test/fixtures';
import { createTestQueryClient } from '../api/test/render';
import { setViewMode } from '../features/project/viewModeStore';
import { mockPhone, skipAnimations, tap } from '../overlays/testing';
import { ProjectScreen, TicketScreen } from './lazyParts';
import { projectSummary } from './test/harness';
import { TrackerApp } from './TrackerApp';

// The Ticket screen's real code, arriving only when the gate opens, like a chunk on a slow network.
// Every case but the last taps while it is still held.
const gate = vi.hoisted(() => {
  let open = () => undefined as void;
  const arrived = new Promise<void>((resolve) => (open = resolve));
  return { arrived, open: () => open() };
});

vi.mock('../features/ticket/TicketScreen', async (importOriginal) => {
  await gate.arrived;
  return importOriginal();
});

const OPEN_SESSION: SessionState = { authRequired: false, authenticated: true };
const READY = listItem(5, STATUS.reviewed, 0, { lastReview: { verdict: 'approved', rating: 4 } });

function renderApp(path: string) {
  window.history.replaceState(null, '', path);
  const client = fakeClient({
    getSession: () => Promise.resolve(OPEN_SESSION),
    listProjects: () => Promise.resolve([projectSummary({ openCount: 3 })]),
    listAllTickets: () => Promise.resolve({ tickets: [READY], statuses }),
    getBoard: () => Promise.resolve(makeBoard()),
    getTicket: () => Promise.resolve(makeTicketDetail()),
  });
  render(<TrackerApp client={client} queryClient={createTestQueryClient()} />);
}

const rowOf = (key: string) => screen.findByRole('button', { name: new RegExp(`^${key}\\b`) });

let restore: Array<() => void> = [];

// Not what they test: under load the screen's code came after a find gave up (PT-176).
beforeAll(() => ProjectScreen.preload());

beforeEach(() => {
  restore = [skipAnimations()];
});

afterEach(() => {
  restore.forEach((undo) => undo());
  window.history.replaceState(null, '', '/');
  window.localStorage.clear();
});

describe('the row that opens a ticket whose screen’s code is on its way', () => {
  it('stays pressed in Ready for you', async () => {
    restore.push(mockPhone(true));
    const user = userEvent.setup();
    renderApp('/');
    const section = await screen.findByRole('region', { name: 'Ready for you' });
    const row = await within(section).findByRole('button', { name: /^MOB-5\b/ });
    await tap(user, row);
    expect(row).toHaveAttribute('data-opening');
  });

  it('stays pressed in the list, and only that row', async () => {
    restore.push(mockPhone(true));
    const user = userEvent.setup();
    renderApp('/p/MOB');
    const row = await rowOf('MOB-1');
    await tap(user, row);
    expect(row).toHaveAttribute('data-opening');
    expect(await rowOf('MOB-2')).not.toHaveAttribute('data-opening');
  });

  it('stays pressed on the board until the ticket opens', async () => {
    setViewMode('MOB', 'board');
    const user = userEvent.setup();
    renderApp('/p/MOB');
    const card = await rowOf('MOB-1');
    await user.click(card);
    expect(card).toHaveAttribute('data-opening');

    await act(async () => {
      gate.open();
      // All of the code, not only the gate: under load it came after a find gave up (PT-176).
      await TicketScreen.preload();
    });
    expect(await screen.findByRole('region', { name: 'Activity' })).toBeInTheDocument();
    expect(card).not.toHaveAttribute('data-opening');
  });
});
