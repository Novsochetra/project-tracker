import type { SessionState } from '@tracker/shared';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeClient } from '../../src/api/test/fakeClient';
import { makeBoard, makeTicketDetail } from '../../src/api/test/fixtures';
import { createTestQueryClient } from '../../src/api/test/render';
import { projectSummary } from '../../src/app/test/harness';
import { TrackerApp } from '../../src/app/TrackerApp';
import { mockPhone, skipAnimations, tap } from '../../src/overlays/testing';

// PT-100: Back on a project while a tapped ticket's screen code was on its way went back to the
// ticket's history entry, which was the project again, so a second Back was needed. From a deep
// link it reached Projects but left the project's entry behind it.

// The Ticket screen's real code, arriving only when the gate opens, like a chunk on a slow network.
const gate = vi.hoisted(() => {
  let open = () => undefined as void;
  const arrived = new Promise<void>((resolve) => (open = resolve));
  return { arrived, open: () => open() };
});

vi.mock('../../src/features/ticket/TicketScreen', async (importOriginal) => {
  await gate.arrived;
  return importOriginal();
});

const OPEN_SESSION: SessionState = { authRequired: false, authenticated: true };

function renderApp(path: string) {
  window.history.replaceState(null, '', path);
  const client = fakeClient({
    getSession: () => Promise.resolve(OPEN_SESSION),
    listProjects: () => Promise.resolve([projectSummary({ openCount: 3 })]),
    listAllTickets: () => Promise.resolve({ tickets: [], statuses: [] }),
    getBoard: () => Promise.resolve(makeBoard()),
    getTicket: () => Promise.resolve(makeTicketDetail()),
  });
  render(<TrackerApp client={client} queryClient={createTestQueryClient()} />);
}

const ticketRow = () => screen.findByRole('button', { name: /^MOB-1\b/ });

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations(), mockPhone(true)];
});

afterEach(() => {
  restore.forEach((undo) => undo());
  window.history.replaceState(null, '', '/');
});

describe('regression: Back while a ticket’s code is on its way', () => {
  // First: the history starts with this test's entry, and the code stays held for the next one.
  it('from a deep link reaches Projects with no project entry left behind', async () => {
    const user = userEvent.setup();
    renderApp('/p/MOB');
    const entries = window.history.length;
    await tap(user, await ticketRow());
    await user.click(screen.getByRole('button', { name: 'Back to Projects' }));
    await waitFor(() => expect(window.location.pathname).toBe('/'));
    expect(window.history.length).toBe(entries);
  });

  it('goes back from the project on show, so one Back reaches Projects', async () => {
    const user = userEvent.setup();
    renderApp('/');
    const main = await screen.findByRole('main');
    await tap(user, await within(main).findByRole('button', { name: /^Mobile app/ }));
    const entries = window.history.length;
    await tap(user, await ticketRow());
    await user.click(screen.getByRole('button', { name: 'Back to Projects' }));
    await waitFor(() => expect(window.location.pathname).toBe('/'));
    expect(window.history.length).toBe(entries);

    await act(async () => {
      gate.open();
      await gate.arrived;
    });
    expect(window.location.pathname).toBe('/');
    expect(await within(main).findByRole('button', { name: /^Mobile app/ })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Activity' })).not.toBeInTheDocument();
  });
});
