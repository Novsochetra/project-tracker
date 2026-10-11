import type { SessionState } from '@tracker/shared';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeClient } from '../../src/api/test/fakeClient';
import { makeBoard, makeTicketDetail } from '../../src/api/test/fixtures';
import { createTestQueryClient } from '../../src/api/test/render';
import { ProjectScreen, TicketScreen } from '../../src/app/lazyParts';
import { projectSummary } from '../../src/app/test/harness';
import { TrackerApp } from '../../src/app/TrackerApp';
import { mockPhone, skipAnimations, tap } from '../../src/overlays/testing';

// Two taps on a project while its screen's code was on its way pushed it twice: navigations are
// transitions, so the location on screen stays the old one until the code arrives, and push
// compared with it. Back then stayed on the project, and a second Back was needed. Ticket rows
// did the same. The sidebar's case is in double-click-sidebar-while-loading.

// Each screen's real code, arriving only when its gate opens, like a chunk on a slow network.
const gates = vi.hoisted(() => {
  const gate = () => {
    let open = () => undefined as void;
    const arrived = new Promise<void>((resolve) => (open = resolve));
    return { arrived, open: () => open() };
  };
  return { project: gate(), ticket: gate() };
});

vi.mock('../../src/features/project/ProjectScreen', async (importOriginal) => {
  await gates.project.arrived;
  return importOriginal();
});

vi.mock('../../src/features/ticket/TicketScreen', async (importOriginal) => {
  await gates.ticket.arrived;
  return importOriginal();
});

// All of the code, not only the gate: under load it came after a find gave up (PT-176).
const arrive = async (
  gate: (typeof gates)['project'],
  screenPart: { preload: () => Promise<unknown> },
) => {
  await act(async () => {
    gate.open();
    await screenPart.preload();
  });
};

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

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations(), mockPhone(true)];
});

afterEach(() => {
  restore.forEach((undo) => undo());
  window.history.replaceState(null, '', '/');
});

describe('regression: a second tap while the screen’s code is on its way', () => {
  it('on a project row pushes nothing more, so one Back returns to Projects', async () => {
    const user = userEvent.setup();
    renderApp('/');
    const main = await screen.findByRole('main');
    const row = await within(main).findByRole('button', { name: /^Mobile app/ });
    await tap(user, row);
    await tap(user, row);
    await arrive(gates.project, ProjectScreen);
    expect(await screen.findByText('Ticket 1')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/p/MOB');

    await user.click(screen.getByRole('button', { name: 'Back to Projects' }));
    await waitFor(() => expect(window.location.pathname).toBe('/'));
  });

  it('on a ticket row pushes nothing more, so one Back returns to the project', async () => {
    await arrive(gates.project, ProjectScreen);
    const user = userEvent.setup();
    renderApp('/p/MOB');
    const row = await screen.findByRole('button', { name: /^MOB-1\b/ });
    await tap(user, row);
    await tap(user, row);
    await arrive(gates.ticket, TicketScreen);
    // The bar is drawn again once the ticket is read, so its Back is taken after that.
    expect(await screen.findByRole('region', { name: 'Activity' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/p/MOB/1');

    await user.click(screen.getByRole('button', { name: 'Back to Mobile app' }));
    await waitFor(() => expect(window.location.pathname).toBe('/p/MOB'));
  });
});
