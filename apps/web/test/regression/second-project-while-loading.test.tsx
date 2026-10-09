import type { SessionState } from '@tracker/shared';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeClient } from '../../src/api/test/fakeClient';
import { listItem, makeBoard, otherProject, STATUS, summaryOf } from '../../src/api/test/fixtures';
import { createTestQueryClient } from '../../src/api/test/render';
import { projectSummary } from '../../src/app/test/harness';
import { TrackerApp } from '../../src/app/TrackerApp';
import { mockPhone, skipAnimations, tap } from '../../src/overlays/testing';

// PT-100: a tap on Website while Mobile app's screen code was on its way pushed both, since a push
// added its history entry before the code arrived. Website opened, and Back showed Mobile app.

// The Project screen's real code, arriving only when the gate opens, like a chunk on a slow network.
const gate = vi.hoisted(() => {
  let open = () => undefined as void;
  const arrived = new Promise<void>((resolve) => (open = resolve));
  return { arrived, open: () => open() };
});

vi.mock('../../src/features/project/ProjectScreen', async (importOriginal) => {
  await gate.arrived;
  return importOriginal();
});

const OPEN_SESSION: SessionState = { authRequired: false, authenticated: true };

const websiteBoard = () => ({
  ...makeBoard([listItem(1, STATUS.todo, 0, { key: 'WEB-1', title: 'Home page' })]),
  project: otherProject,
});

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations(), mockPhone(true)];
});

afterEach(() => {
  restore.forEach((undo) => undo());
  window.history.replaceState(null, '', '/');
});

describe('regression: a tap on a second project while the first one’s code is on its way', () => {
  it('opens the second with one history entry, so one Back returns to Projects', async () => {
    const user = userEvent.setup();
    const client = fakeClient({
      getSession: () => Promise.resolve(OPEN_SESSION),
      listProjects: () => Promise.resolve([projectSummary(), summaryOf(otherProject)]),
      listAllTickets: () => Promise.resolve({ tickets: [], statuses: [] }),
      getBoard: (key: string) => Promise.resolve(key === 'WEB' ? websiteBoard() : makeBoard()),
    });
    render(<TrackerApp client={client} queryClient={createTestQueryClient()} />);
    const main = await screen.findByRole('main');
    const entries = window.history.length;
    await tap(user, await within(main).findByRole('button', { name: /^Mobile app/ }));
    await tap(user, within(main).getByRole('button', { name: /^Website/ }));
    await act(async () => {
      gate.open();
      await gate.arrived;
    });
    expect(await screen.findByText('Home page')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/p/WEB');
    expect(window.history.length).toBe(entries + 1);

    await user.click(screen.getByRole('button', { name: 'Back to Projects' }));
    await waitFor(() => expect(window.location.pathname).toBe('/'));
    expect(screen.queryByText('Ticket 1')).not.toBeInTheDocument();
  });
});
