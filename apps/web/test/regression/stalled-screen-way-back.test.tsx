import type { SessionState } from '@tracker/shared';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { fakeClient } from '../../src/api/test/fakeClient';
import { makeBoard, makeTicketDetail } from '../../src/api/test/fixtures';
import { createTestQueryClient } from '../../src/api/test/render';
import { projectSummary } from '../../src/app/test/harness';
import { TrackerApp } from '../../src/app/TrackerApp';
import { PUSH_WAIT_LIMIT_MS } from '../../src/navigation/pushWait';
import { mockPhone, skipAnimations, tap } from '../../src/overlays/testing';

// PT-108: on a phone, the loading state of a screen whose code stalled (a push past its time
// limit, or a first load straight into it) was a spinner alone, with no nav bar and no Back, so
// only the edge swipe or the browser's Back left it. And the browser's Forward to such a screen
// put that spinner in place of the whole stack, as the boundary above the stack caught it.

// Each screen's real code, held until the test lets it through, like a chunk request that hangs.
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

const OPEN_SESSION: SessionState = { authRequired: false, authenticated: true };

function renderApp(path: string) {
  window.history.replaceState(null, '', path);
  const client = fakeClient({
    getSession: () => Promise.resolve(OPEN_SESSION),
    listProjects: () => Promise.resolve([projectSummary({ openCount: 3 })]),
    listAllTickets: () => Promise.resolve({ tickets: [], statuses: [] }),
    getBoard: () => Promise.resolve(makeBoard()),
    getProject: () => Promise.resolve(makeBoard()),
    getTicket: () => Promise.resolve(makeTicketDetail()),
  });
  render(<TrackerApp client={client} queryClient={createTestQueryClient()} />);
}

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const layer = (path: string) => document.querySelector<HTMLElement>(`[data-stack-path="${path}"]`);
const browser = (step: 'back' | 'forward') =>
  act(async () => {
    window.history[step]();
    await vi.advanceTimersByTimeAsync(10);
  });

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

describe('regression: a screen whose code stalls, on a phone', () => {
  // First: both screens' code is still held here.
  it('a first load straight into it has a nav bar with Back', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp('/p/MOB/1');
    const main = await screen.findByRole('main');
    expect(await within(main).findByText('MOB-1')).toBeInTheDocument();
    await user.click(await within(main).findByRole('button', { name: 'Back to Mobile app' }));
    expect(window.location.pathname).toBe('/p/MOB');

    await user.click(await within(main).findByRole('button', { name: 'Back to Projects' }));
    expect(window.location.pathname).toBe('/');
    expect(await within(main).findByRole('button', { name: /^Mobile app/ })).toBeInTheDocument();
  });

  it('a push past its time limit slides in a nav bar with Back, and so does Forward to it', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp('/');
    const main = await screen.findByRole('main');
    await tap(user, await within(main).findByRole('button', { name: /^Mobile app/ }));
    await advance(PUSH_WAIT_LIMIT_MS);
    const loading = layer('/p/MOB')!;
    expect(within(loading).getByRole('status')).toHaveTextContent('Loading');
    await user.click(within(loading).getByRole('button', { name: 'Back to Projects' }));
    expect(window.location.pathname).toBe('/');
    await waitFor(() => expect(layer('/p/MOB')).toBeNull());

    await browser('forward');
    expect(window.location.pathname).toBe('/p/MOB');
    const again = layer('/p/MOB')!;
    expect(within(again).getByRole('button', { name: 'Back to Projects' })).toBeVisible();
    expect(within(again).getByRole('status')).toHaveTextContent('Loading');

    await act(async () => {
      gates.project.open();
      await gates.project.arrived;
    });
    expect(await screen.findByText('Ticket 1')).toBeInTheDocument();
  });
});
