import type { SessionState } from '@tracker/shared';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { fakeClient } from '../../src/api/test/fakeClient';
import { makeBoard, makeTicketDetail } from '../../src/api/test/fixtures';
import { createTestQueryClient } from '../../src/api/test/render';
import { projectSummary } from '../../src/app/test/harness';
import { TrackerApp } from '../../src/app/TrackerApp';
import { PUSH_WAIT_LIMIT_MS } from '../../src/navigation/pushWait';
import { mockPhone, skipAnimations, tap } from '../../src/overlays/testing';

// PT-104: a screen's code that stalled (a chunk request that never answers) kept the push waiting
// and the tapped row pressed until the browser gave up on the request, with nothing else on
// screen. And a cold deep link to an odd spelling of a path (/p/MOB/01) kept that URL until the
// screen's code arrived, because the replace that puts it right waited for the code too.

// Each screen's real code, arriving or failing only when the test says so, like a chunk request
// that hangs.
const gates = vi.hoisted(() => {
  const gate = () => {
    let open = () => undefined as void;
    let fail = () => undefined as void;
    const arrived = new Promise<void>((resolve, reject) => {
      open = resolve;
      fail = () => reject(new Error('The chunk never came'));
    });
    return { arrived, open: () => open(), fail: () => fail() };
  };
  return { project: gate(), ticket: gate() };
});

vi.mock('../../src/features/project/ProjectScreen', async (importOriginal) => {
  await gates.project.arrived;
  return importOriginal();
});

vi.mock('../../src/features/project/projectScreens', async () =>
  (await import('../../src/app/test/projectScreensMock')).projectScreensWithoutAsk(),
);

vi.mock('../../src/features/ticket/TicketScreen', async (importOriginal) => {
  await gates.ticket.arrived;
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

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const arrive = (gate: (typeof gates)['project']) =>
  act(async () => {
    gate.open();
    await gate.arrived;
  });
const layer = (path: string) => document.querySelector<HTMLElement>(`[data-stack-path="${path}"]`);

let restore: Array<() => void> = [];
let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  restore = [skipAnimations(), mockPhone(true)];
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  restore.forEach((undo) => undo());
  consoleError.mockRestore();
  vi.useRealTimers();
  window.history.replaceState(null, '', '/');
});

describe('regression: a screen’s code that stalls', () => {
  // First: both screens' code is still held here.
  it('does not keep a cold deep link’s odd URL until the code arrives', () => {
    window.history.replaceState(null, '', '/');
    const entries = window.history.length;
    renderApp('/p/MOB/01');
    expect(window.location.pathname).toBe('/p/MOB/1');
    expect(window.history.length).toBe(entries);
  });

  it('opens a project at the time limit in its loading state, with the row let go', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp('/');
    const main = await screen.findByRole('main');
    const row = await within(main).findByRole('button', { name: /^Mobile app/ });
    const entries = window.history.length;
    await tap(user, row);
    await advance(PUSH_WAIT_LIMIT_MS - 1_000);
    expect(window.location.pathname).toBe('/');
    expect(row).toHaveAttribute('data-opening');

    await advance(1_000);
    expect(window.location.pathname).toBe('/p/MOB');
    expect(window.history.length).toBe(entries + 1);
    expect(within(layer('/p/MOB')!).getByText('Loading')).toBeInTheDocument();
    expect(row).not.toHaveAttribute('data-opening');

    await arrive(gates.project);
    expect(await screen.findByText('Ticket 1')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/p/MOB');
    expect(window.history.length).toBe(entries + 1);
  });

  it('opens a ticket at the time limit, and its error offers Back when the code fails', async () => {
    await arrive(gates.project);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp('/p/MOB');
    const row = await screen.findByRole('button', { name: /^MOB-1\b/ });
    await tap(user, row);
    await advance(PUSH_WAIT_LIMIT_MS);
    expect(window.location.pathname).toBe('/p/MOB/1');
    expect(within(layer('/p/MOB/1')!).getByText('Loading')).toBeInTheDocument();
    expect(row).not.toHaveAttribute('data-opening');

    await act(async () => {
      gates.ticket.fail();
      await gates.ticket.arrived.catch(() => undefined);
    });
    const error = layer('/p/MOB/1')!;
    expect(await within(error).findByText('Something went wrong')).toBeInTheDocument();
    await user.click(within(error).getByRole('button', { name: 'Back' }));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(window.location.pathname).toBe('/p/MOB');
  });
});
