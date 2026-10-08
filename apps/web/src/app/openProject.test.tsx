import type { SessionState } from '@tracker/shared';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeClient } from '../api/test/fakeClient';
import { makeBoard } from '../api/test/fixtures';
import { createTestQueryClient } from '../api/test/render';
import { skipAnimations } from '../overlays/testing';
import { projectSummary } from './test/harness';
import { TrackerApp } from './TrackerApp';

// The Project screen's real code, arriving only when the gate opens, like a chunk on a slow network.
const gate = vi.hoisted(() => {
  let open = () => undefined as void;
  const arrived = new Promise<void>((resolve) => (open = resolve));
  return { arrived, open: () => open() };
});

vi.mock('../features/project/ProjectScreen', async (importOriginal) => {
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

function renderApp() {
  const getBoard = vi.fn(() => Promise.resolve(makeBoard()));
  const client = fakeClient({
    getSession: () => Promise.resolve(OPEN_SESSION),
    listProjects: () => Promise.resolve([projectSummary({ openCount: 3 })]),
    listAllTickets: () => Promise.resolve({ tickets: [], statuses: [] }),
    getBoard,
  });
  render(<TrackerApp client={client} queryClient={createTestQueryClient()} />);
  return { getBoard };
}

const sidebar = () => screen.findByRole('complementary', { name: 'Projects' });

describe('opening a project', () => {
  // First, while the code is still held: the row case below opens the gate.
  it('from the sidebar reads its board on the press too, while the code is on its way', async () => {
    const user = userEvent.setup();
    const { getBoard } = renderApp();
    const item = await within(await sidebar()).findByRole('button', { name: /^Mobile app/ });
    await user.click(item);
    expect(getBoard).toHaveBeenCalledTimes(1);
    expect(getBoard).toHaveBeenCalledWith('MOB');
    expect(screen.queryByText('Ticket 1')).not.toBeInTheDocument();
    expect(item).toHaveAttribute('data-opening');
  });

  it('reads its board on the press, while the screen’s code is on its way, and only then', async () => {
    const user = userEvent.setup();
    const { getBoard } = renderApp();
    const main = await screen.findByRole('main');
    const row = await within(main).findByRole('button', { name: /^Mobile app/ });
    await user.click(row);
    expect(getBoard).toHaveBeenCalledTimes(1);
    expect(getBoard).toHaveBeenCalledWith('MOB');
    expect(screen.queryByText('Ticket 1')).not.toBeInTheDocument();
    // Pressed until the screen opens, so a slow network doesn't look like a missed tap.
    expect(row).toHaveAttribute('data-opening');

    await act(async () => {
      gate.open();
      await gate.arrived;
    });
    expect(await screen.findByText('Ticket 1')).toBeInTheDocument();
    expect(getBoard).toHaveBeenCalledTimes(1);
    expect(row).not.toHaveAttribute('data-opening');
  });

  it('from the sidebar reads its board once too', async () => {
    gate.open();
    const user = userEvent.setup();
    const { getBoard } = renderApp();
    await user.click(await within(await sidebar()).findByRole('button', { name: /^Mobile app/ }));
    expect(await screen.findByText('Ticket 1')).toBeInTheDocument();
    expect(getBoard).toHaveBeenCalledTimes(1);
  });
});
