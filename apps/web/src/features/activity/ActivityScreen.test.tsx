import { ApiError } from '@tracker/client';
import type { ActivityBatch, ActivityRun, RunActivity } from '@tracker/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { currentPath, renderWithApp } from '../../app/test/harness';
import { routePath, StackNavigator } from '../../navigation';
import { mockPhone, skipAnimations } from '../../overlays/testing';
import { ActivityScreen } from './ActivityScreen';

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations()];
});

afterEach(() => {
  restore.forEach((undo) => undo());
});

const MINUTE = 60_000;

const run = (overrides: Partial<ActivityRun>): ActivityRun => ({
  runId: 'r-1',
  batchId: null,
  projectKey: 'MOB',
  projectName: 'Mobile app',
  ticketKey: 'MOB-3',
  ticketTitle: 'Crash on login',
  state: 'running',
  startedAt: Date.now() - 12 * MINUTE,
  createdAt: Date.now() - 13 * MINUTE,
  ...overrides,
});

const batch = (overrides: Partial<ActivityBatch>): ActivityBatch => ({
  runId: 'b-1',
  projectKey: 'MOB',
  projectName: 'Mobile app',
  state: 'running',
  total: 10,
  done: 3,
  failedKeys: [],
  startedAt: Date.now() - 5 * MINUTE,
  createdAt: Date.now() - 6 * MINUTE,
  ...overrides,
});

const activity = (runs: ActivityRun[], limit = 5, batches: ActivityBatch[] = []): RunActivity => ({
  runs,
  batches,
  runningCount: runs.filter((item) => item.state === 'running').length,
  limit,
});

const stack = (
  <StackNavigator
    renderScreen={(route) =>
      route.name === 'activity' ? <ActivityScreen /> : <p>Opened {routePath(route)}</p>
    }
  />
);

function renderActivity(
  listRunActivity: () => Promise<RunActivity>,
  client: Record<string, unknown> = {},
) {
  return renderWithApp(stack, {
    path: '/activity',
    client: { listRunActivity: vi.fn(listRunActivity), ...client },
  });
}

describe('ActivityScreen', () => {
  it('shows every active run with project, ticket, state and how long it has run', async () => {
    renderActivity(() =>
      Promise.resolve(
        activity([
          run({}),
          run({
            runId: 'r-2',
            projectKey: 'WEB',
            projectName: 'Website',
            ticketKey: 'WEB-1',
            ticketTitle: 'Search',
            state: 'waiting',
            startedAt: null,
            createdAt: Date.now() - 3 * MINUTE,
          }),
          run({ runId: 'r-3', ticketKey: 'MOB-4', ticketTitle: 'Sync', state: 'failed' }),
        ]),
      ),
    );
    const running = await screen.findByRole('button', { name: /MOB-3/ });
    expect(running).toHaveTextContent('Mobile app');
    expect(running).toHaveTextContent('Crash on login');
    expect(running).toHaveTextContent('Running');
    expect(running).toHaveTextContent('12m');
    const waiting = screen.getByRole('button', { name: /WEB-1/ });
    expect(waiting).toHaveTextContent('Website');
    expect(waiting).toHaveTextContent('Waiting');
    expect(waiting).toHaveTextContent('waiting 3m');
    expect(screen.getByRole('button', { name: /MOB-4/ })).toHaveTextContent('Failed');
  });

  it('shows the running count and the limit', async () => {
    renderActivity(() => Promise.resolve(activity([run({}), run({ runId: 'r-2' })], 5)));
    expect(await screen.findByText('2 running now · limit 5')).toBeInTheDocument();
  });

  it('opens the ticket of a tapped row', async () => {
    const user = userEvent.setup();
    renderActivity(() => Promise.resolve(activity([run({})])));
    await user.click(await screen.findByRole('button', { name: /MOB-3/ }));
    expect(currentPath()).toBe('/p/MOB/3');
    expect(await screen.findByText('Opened /p/MOB/3')).toBeInTheDocument();
  });

  it('says so when nothing runs', async () => {
    renderActivity(() => Promise.resolve(activity([])));
    expect(await screen.findByText('Nothing running')).toBeInTheDocument();
    expect(screen.getByText('0 running now · limit 5')).toBeInTheDocument();
  });

  it('tells a failed load and tries again', async () => {
    const user = userEvent.setup();
    const load = vi
      .fn<() => Promise<RunActivity>>()
      .mockRejectedValueOnce(new ApiError(500, 'internal', 'Broke'))
      .mockResolvedValue(activity([run({})]));
    renderActivity(load);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: /MOB-3/ })).toBeInTheDocument();
  });

  it('has Projects and Activity tabs on a phone, and none on a wide screen', async () => {
    const user = userEvent.setup();
    restore.push(mockPhone(true));
    renderActivity(() => Promise.resolve(activity([run({})])));
    const tabs = await screen.findByRole('navigation', { name: 'Home' });
    expect(tabs).toHaveTextContent('Projects');
    expect(screen.getByRole('button', { name: 'Activity' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await user.click(screen.getByRole('button', { name: 'Projects' }));
    expect(currentPath()).toBe('/');
  });

  it('leaves the tabs out on a wide screen', async () => {
    restore.push(mockPhone(false));
    renderActivity(() => Promise.resolve(activity([run({})])));
    await screen.findByRole('button', { name: /MOB-3/ });
    expect(screen.queryByRole('navigation', { name: 'Home' })).not.toBeInTheDocument();
  });

  describe('a Run all batch', () => {
    const batchRow = () => screen.findByRole('button', { name: /^Mobile app Run all/ });

    it('shows its project, how many tickets are done and its state above the runs', async () => {
      renderActivity(() => Promise.resolve(activity([run({ batchId: 'b-1' })], 5, [batch({})])));
      const row = await batchRow();
      expect(row).toHaveTextContent('Mobile app');
      expect(row).toHaveTextContent('3 of 10 done');
      expect(row).toHaveTextContent('Running');
      const ticket = screen.getByRole('button', { name: /MOB-3/ });
      expect(row.compareDocumentPosition(ticket) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('lists the tickets it did not finish, with no Stop once it ended', async () => {
      renderActivity(() =>
        Promise.resolve(
          activity([], 5, [batch({ state: 'failed', failedKeys: ['MOB-3', 'MOB-7'] })]),
        ),
      );
      const row = await batchRow();
      expect(row).toHaveTextContent('Failed');
      expect(row).toHaveTextContent('Not finished: MOB-3, MOB-7');
      expect(screen.queryByRole('button', { name: /^Stop Run all for/ })).not.toBeInTheDocument();
      expect(screen.queryByText('Nothing running')).not.toBeInTheDocument();
    });

    it('stops the batch run and loads the list again', async () => {
      const user = userEvent.setup();
      const cancelRun = vi.fn().mockResolvedValue({});
      const load = vi
        .fn<() => Promise<RunActivity>>()
        .mockResolvedValueOnce(activity([], 5, [batch({ state: 'waiting' })]))
        .mockResolvedValue(activity([]));
      renderActivity(load, { cancelRun });
      await user.click(await screen.findByRole('button', { name: /^Stop Run all for/ }));
      expect(cancelRun).toHaveBeenCalledWith('b-1');
      expect(await screen.findByText('Nothing running')).toBeInTheDocument();
    });

    it('says why a stop failed', async () => {
      const user = userEvent.setup();
      const cancelRun = vi.fn().mockRejectedValue(new ApiError(409, 'conflict', 'Already ended'));
      renderActivity(() => Promise.resolve(activity([], 5, [batch({})])), { cancelRun });
      await user.click(await screen.findByRole('button', { name: /^Stop Run all for/ }));
      expect(await screen.findByText('Already ended')).toBeInTheDocument();
    });

    it('opens its project when tapped', async () => {
      const user = userEvent.setup();
      renderActivity(() => Promise.resolve(activity([], 5, [batch({})])));
      await user.click(await batchRow());
      expect(currentPath()).toBe('/p/MOB');
    });
  });
});
