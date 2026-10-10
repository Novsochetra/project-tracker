import type { SessionState } from '@tracker/shared';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeClient } from '../../src/api/test/fakeClient';
import { makeBoard } from '../../src/api/test/fixtures';
import { createTestQueryClient } from '../../src/api/test/render';
import { projectSummary } from '../../src/app/test/harness';
import { TrackerApp } from '../../src/app/TrackerApp';
import { skipAnimations } from '../../src/overlays/testing';

// PT-100: on desktop, All projects in the sidebar while Mobile app's screen code was on its way
// cancelled the project but left its history entry (with one of its own on top), so the browser's
// Back opened Mobile app.

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

vi.mock('../../src/features/project/projectScreens', async () =>
  (await import('../../src/app/test/projectScreensMock')).projectScreensWithoutAsk(),
);

const OPEN_SESSION: SessionState = { authRequired: false, authenticated: true };

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations()];
});

afterEach(() => {
  restore.forEach((undo) => undo());
  window.history.replaceState(null, '', '/');
});

describe('regression: All projects while a project’s code is on its way', () => {
  it('cancels the project and adds nothing to the history', async () => {
    const user = userEvent.setup();
    const client = fakeClient({
      getSession: () => Promise.resolve(OPEN_SESSION),
      listProjects: () => Promise.resolve([projectSummary({ openCount: 3 })]),
      listAllTickets: () => Promise.resolve({ tickets: [], statuses: [] }),
      getBoard: () => Promise.resolve(makeBoard()),
    });
    render(<TrackerApp client={client} queryClient={createTestQueryClient()} />);
    const sidebar = await screen.findByRole('complementary', { name: 'Projects' });
    const item = await within(sidebar).findByRole('button', { name: /^Mobile app/ });
    const entries = window.history.length;
    await user.click(item);
    await user.click(within(sidebar).getByRole('button', { name: 'All projects' }));
    expect(item).not.toHaveAttribute('data-opening');
    await act(async () => {
      gate.open();
      await gate.arrived;
    });

    expect(window.location.pathname).toBe('/');
    expect(window.history.length).toBe(entries);
    expect(screen.queryByText('Ticket 1')).not.toBeInTheDocument();
  });
});
