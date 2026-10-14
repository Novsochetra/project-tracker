import type { Run, RunJob } from '@tracker/shared';
import { describe, expect, it, vi } from 'vitest';
import { createWatcher } from '../../src/watch/watcher';
import type { WatchApi } from '../../src/watch/watchApi';
import { noAsks } from '../watch/fakeTracker';

// Reviewer 140: Ctrl-C while a run was being taken still started Claude, with a signal that was
// never aborted, and the helper then waited for the whole run before it quit.
describe('regression: stopping while a run is being taken', () => {
  it('reports the run cancelled without starting Claude', async () => {
    let answer = (_job: RunJob) => undefined as void;
    const job: RunJob = {
      prompt: 'Go',
      resumeSessionId: null,
      ticketKeys: [],
      run: {
        id: 'r-1',
        kind: 'ticket',
        projectKey: 'MOB',
        ticketKey: 'MOB-1',
        chatId: null,
        askOptions: null,
        runnerId: 'x',
        runnerName: 'Mac',
        status: 'running',
        error: null,
        createdAt: 1,
        startedAt: 2,
        endedAt: null,
        stepCount: 0,
        batchId: null,
      },
    };
    const finishRun = vi.fn(() => Promise.resolve({} as Run));
    const api = {
      takeNextRun: (_id: string, kind: string) =>
        kind === 'ticket'
          ? new Promise<RunJob>((resolve) => (answer = resolve))
          : Promise.resolve(null),
      finishRun,
    } as unknown as WatchApi;
    const runClaude = vi.fn(() =>
      Promise.resolve({ code: 0, signal: null, output: '', results: [] }),
    );
    const watcher = createWatcher(
      { api, runClaude, runAsk: noAsks, log: () => undefined, retryDelay: () => 0 },
      { runnerId: 'x', name: 'Mac', projectKey: 'MOB', trackerUrl: 'http://tracker.test' },
    );
    const looking = watcher.lookForWork();
    const stopped = watcher.stop();
    answer(job);
    await Promise.all([looking, stopped]);
    expect(runClaude).not.toHaveBeenCalled();
    expect(finishRun).toHaveBeenCalledWith('r-1', { status: 'cancelled' });
  });
});
