import type { SessionState } from '@tracker/shared';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeClient } from '../../src/api/test/fakeClient';
import { makeBoard } from '../../src/api/test/fixtures';
import { createTestQueryClient } from '../../src/api/test/render';
import { projectSummary } from '../../src/app/test/harness';
import { TrackerApp } from '../../src/app/TrackerApp';
import { skipAnimations } from '../../src/overlays/testing';

// A double click on a project in the sidebar while its screen's code was on its way pushed it
// twice (see double-tap-while-loading), so the browser's Back stayed on the project.

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

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations()];
});

afterEach(() => {
  restore.forEach((undo) => undo());
  window.history.replaceState(null, '', '/');
});

describe('regression: a double click on a sidebar project while its code is on its way', () => {
  it('pushes it once, so one browser Back returns to Projects', async () => {
    const user = userEvent.setup();
    const client = fakeClient({
      getSession: () => Promise.resolve(OPEN_SESSION),
      listProjects: () => Promise.resolve([projectSummary({ openCount: 3 })]),
      listAllTickets: () => Promise.resolve({ tickets: [], statuses: [] }),
      getBoard: () => Promise.resolve(makeBoard()),
    });
    render(<TrackerApp client={client} queryClient={createTestQueryClient()} />);
    const sidebar = await screen.findByRole('complementary', { name: 'Projects' });
    await user.dblClick(await within(sidebar).findByRole('button', { name: /^Mobile app/ }));
    await act(async () => {
      gate.open();
      await gate.arrived;
    });
    expect(await screen.findByText('Ticket 1')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/p/MOB');

    act(() => window.history.back());
    await waitFor(() => expect(window.location.pathname).toBe('/'));
  });
});
