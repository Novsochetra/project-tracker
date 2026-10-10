import { ApiError } from '@tracker/client';
import type { FinishRunInput, Run, RunJob } from '@tracker/shared';
import { describe, expect, it, vi } from 'vitest';
import type { ClaudeExit } from '../../src/watch/outcome';
import { createWatcher } from '../../src/watch/watcher';
import type { WatchApi } from '../../src/watch/watchApi';

const RUNNER = 'runner-1';

const runOf = (id: string, ticketKey: string): Run => ({
  id,
  ticketKey,
  runnerId: RUNNER,
  runnerName: 'Mac',
  status: 'running',
  error: null,
  createdAt: 1,
  startedAt: 2,
  endedAt: null,
});

function fakeTracker(jobs: RunJob[]) {
  const ended: (FinishRunInput & { id: string })[] = [];
  const statuses = new Map<string, Run['status']>();
  const api: WatchApi = {
    listProjects: vi.fn(),
    eventsUrl: () => 'http://tracker.test/api/events',
    registerRunner: vi.fn(() => Promise.resolve({} as never)),
    takeNextRun: vi.fn(() => Promise.resolve(jobs.shift() ?? null)),
    finishRun: vi.fn((id: string, input: FinishRunInput) => {
      ended.push({ id, ...input });
      return Promise.resolve({} as Run);
    }),
    getRun: vi.fn((id: string) =>
      Promise.resolve({ ...runOf(id, 'MOB-1'), status: statuses.get(id) ?? 'running' }),
    ),
  };
  return { api, ended, statuses };
}

const job = (id: string, ticketKey: string, prompt = `Work on ${ticketKey}`): RunJob => ({
  run: runOf(id, ticketKey),
  prompt,
});

function watcherWith(
  api: WatchApi,
  runClaude: (prompt: string, signal: AbortSignal) => Promise<ClaudeExit>,
) {
  const log: string[] = [];
  const watcher = createWatcher(
    { api, runClaude, log: (text) => log.push(text), retryDelay: () => 1 },
    { runnerId: RUNNER, name: 'Mac', projectKey: 'MOB', trackerUrl: 'http://tracker.test' },
  );
  return { watcher, log };
}

const exits =
  (code: number, output = '') =>
  () =>
    Promise.resolve({ code, signal: null, output });

describe('the watcher', () => {
  it('runs each waiting run in turn and reports how it ended', async () => {
    const tracker = fakeTracker([job('r-1', 'MOB-1'), job('r-2', 'MOB-2', 'FAIL')]);
    const prompts: string[] = [];
    const { watcher, log } = watcherWith(tracker.api, (prompt) => {
      prompts.push(prompt);
      return Promise.resolve(
        prompt === 'FAIL'
          ? { code: 1, signal: null, output: 'boom' }
          : { code: 0, signal: null, output: '' },
      );
    });
    await watcher.lookForWork();
    expect(prompts).toEqual(['Work on MOB-1', 'FAIL']);
    expect(tracker.ended).toEqual([
      { id: 'r-1', status: 'done' },
      { id: 'r-2', status: 'failed', error: 'Claude Code exited with 1.\nboom' },
    ]);
    expect(log).toContain('MOB-1: Claude Code finished.');
  });

  it('refuses a run for another project without starting Claude', async () => {
    const tracker = fakeTracker([job('r-1', 'WEB-4')]);
    const runClaude = vi.fn(exits(0));
    await watcherWith(tracker.api, runClaude).watcher.lookForWork();
    expect(runClaude).not.toHaveBeenCalled();
    expect(tracker.ended).toEqual([
      { id: 'r-1', status: 'failed', error: 'This helper only runs MOB tickets, not WEB-4.' },
    ]);
  });

  it('works on one run at a time however often it is asked', async () => {
    const tracker = fakeTracker([job('r-1', 'MOB-1')]);
    let finish = () => undefined as void;
    const runClaude = vi.fn(
      () =>
        new Promise<ClaudeExit>(
          (resolve) => (finish = () => resolve({ code: 0, signal: null, output: '' })),
        ),
    );
    const { watcher } = watcherWith(tracker.api, runClaude);
    const first = watcher.lookForWork();
    await vi.waitFor(() => expect(runClaude).toHaveBeenCalledTimes(1));
    void watcher.lookForWork();
    watcher.onRunEvent({
      type: 'run',
      runId: 'r-9',
      runnerId: RUNNER,
      projectId: 'p',
      ticketId: 't',
      status: 'queued',
    });
    finish();
    await first;
    expect(runClaude).toHaveBeenCalledTimes(1);
  });

  it('stops Claude when the person cancels, by event or found at check-in', async () => {
    for (const how of ['event', 'check-in'] as const) {
      const tracker = fakeTracker([job('r-1', 'MOB-1')]);
      const { watcher } = watcherWith(
        tracker.api,
        (_prompt, signal) =>
          new Promise((resolve) =>
            signal.addEventListener('abort', () =>
              resolve({ code: null, signal: 'SIGTERM', output: '' }),
            ),
          ),
      );
      const working = watcher.lookForWork();
      await vi.waitFor(() => expect(tracker.api.takeNextRun).toHaveBeenCalled());
      await new Promise((resolve) => setTimeout(resolve, 10));
      if (how === 'event') {
        watcher.onRunEvent({
          type: 'run',
          runId: 'r-1',
          runnerId: 'other',
          projectId: 'p',
          ticketId: 't',
          status: 'cancelled',
        });
        watcher.onRunEvent({
          type: 'run',
          runId: 'r-1',
          runnerId: RUNNER,
          projectId: 'p',
          ticketId: 't',
          status: 'cancelled',
        });
      } else {
        tracker.statuses.set('r-1', 'cancelled');
        await watcher.checkIn();
      }
      await working;
      expect(tracker.ended).toEqual([{ id: 'r-1', status: 'cancelled' }]);
    }
  });

  it('keeps reporting while the tracker restarts, and gives up on a refusal', async () => {
    const tracker = fakeTracker([job('r-1', 'MOB-1'), job('r-2', 'MOB-2')]);
    const finishRun = vi
      .fn<WatchApi['finishRun']>()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockRejectedValueOnce(new ApiError(502, 'http_error', 'Bad Gateway'))
      .mockResolvedValueOnce({} as Run)
      .mockRejectedValueOnce(new ApiError(409, 'conflict', 'This run already ended (cancelled).'));
    const { watcher, log } = watcherWith({ ...tracker.api, finishRun }, exits(0));
    await watcher.lookForWork();
    expect(finishRun).toHaveBeenCalledTimes(4);
    expect(log).toContain(
      "The tracker didn't take how MOB-2 ended: This run already ended (cancelled).",
    );
  });

  it('says once that the tracker is out of reach, and when it is back', async () => {
    let down = true;
    const tracker = fakeTracker([]);
    const offline = Object.assign(new TypeError('fetch failed'), {
      cause: new Error('connect ECONNREFUSED'),
    });
    const fails =
      <T>(answer: () => Promise<T>) =>
      () =>
        down ? Promise.reject(offline) : answer();
    const api = {
      ...tracker.api,
      registerRunner: vi.fn(fails(() => Promise.resolve({} as never))),
      takeNextRun: vi.fn(fails(() => Promise.resolve(null))),
    };
    const { watcher, log } = watcherWith(api, exits(0));
    await watcher.checkIn();
    await watcher.lookForWork();
    await watcher.checkIn();
    down = false;
    await watcher.checkIn();
    await watcher.lookForWork();
    expect(log).toEqual([
      'Could not reach the tracker at http://tracker.test (connect ECONNREFUSED). Is it running? Check TRACKER_URL (or --url).',
      'In touch with the tracker again.',
    ]);
  });
});
