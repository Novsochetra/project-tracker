import { ApiError } from '@tracker/client';
import type { Run } from '@tracker/shared';
import { describe, expect, it, vi } from 'vitest';
import type { OnSteps } from '../../src/watch/claudeRunners';
import type { ClaudeExit } from '../../src/watch/outcome';
import { createWatcher } from '../../src/watch/watcher';
import type { WatchApi } from '../../src/watch/watchApi';
import { fakeTracker, job, noAsks, RUNNER } from './fakeTracker';

function watcherWith(
  api: WatchApi,
  runClaude: (prompt: string, signal: AbortSignal, onSteps: OnSteps) => Promise<ClaudeExit>,
) {
  const log: string[] = [];
  const watcher = createWatcher(
    { api, runClaude, runAsk: noAsks, log: (text) => log.push(text), retryDelay: () => 1 },
    { runnerId: RUNNER, name: 'Mac', projectKey: 'MOB', trackerUrl: 'http://tracker.test' },
  );
  return { watcher, log };
}

const exits =
  (code: number, output = '') =>
  () =>
    Promise.resolve({ code, signal: null, output, results: [] });

describe('the watcher', () => {
  it('runs each waiting run in turn and reports how it ended', async () => {
    const tracker = fakeTracker([job('r-1', 'MOB-1'), job('r-2', 'MOB-2', 'FAIL')]);
    const prompts: string[] = [];
    const { watcher, log } = watcherWith(tracker.api, (prompt) => {
      prompts.push(prompt);
      return Promise.resolve(
        prompt === 'FAIL'
          ? { code: 1, signal: null, output: 'boom', results: [] }
          : { code: 0, signal: null, output: '', results: [] },
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

  it("sends what Claude did as the run's steps, all before the run's end", async () => {
    const tracker = fakeTracker([job('r-1', 'MOB-1')]);
    const step = { kind: 'tool', label: 'Read a.ts', subAgent: false, toolId: 't-1' } as const;
    const { watcher } = watcherWith(tracker.api, (_prompt, _signal, onSteps) => {
      onSteps([step]);
      return exits(0)();
    });
    await watcher.lookForWork();
    expect(tracker.steps).toEqual([{ id: 'r-1', runnerId: RUNNER, steps: [step] }]);
    const [stepsCall] = vi.mocked(tracker.api.addRunSteps).mock.invocationCallOrder;
    const [finishCall] = vi.mocked(tracker.api.finishRun).mock.invocationCallOrder;
    expect(stepsCall).toBeLessThan(finishCall!);
  });

  it('still ends the run when its steps cannot be sent', async () => {
    const tracker = fakeTracker([job('r-1', 'MOB-1')]);
    vi.mocked(tracker.api.addRunSteps).mockRejectedValue(new Error('fetch failed'));
    const { watcher, log } = watcherWith(tracker.api, (_prompt, _signal, onSteps) => {
      onSteps([{ kind: 'text', label: 'Looking.', subAgent: false, toolId: null }]);
      return exits(0)();
    });
    await watcher.lookForWork();
    expect(tracker.ended).toEqual([{ id: 'r-1', status: 'done' }]);
    expect(log).toContain("Couldn't show the tracker what Claude is doing: fetch failed");
  });

  it('hands back a report from any turn, not only the last', async () => {
    const tracker = fakeTracker([job('r-1', 'MOB-1')]);
    const block = 'TICKET: MOB-1\nSTATUS: done\nSUMMARY: Fixed it.\nFILES: a.ts\nNEXT: none';
    const report = `\`\`\`\n${block}\n\`\`\``;
    const turn = (text: string) => ({ text, sessionId: undefined, isError: false });
    const { watcher } = watcherWith(tracker.api, () =>
      Promise.resolve({
        code: 0,
        signal: null,
        output: '',
        results: [turn(`Did the work.\n\n${report}`), turn('The sub agent agreed.')],
      }),
    );
    await watcher.lookForWork();
    expect(tracker.reports).toEqual([{ text: block, ticketKey: 'MOB-1' }]);
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
          (resolve) => (finish = () => resolve({ code: 0, signal: null, output: '', results: [] })),
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
      chatId: null,
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
              resolve({ code: null, signal: 'SIGTERM', output: '', results: [] }),
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
          chatId: null,
          status: 'cancelled',
        });
        watcher.onRunEvent({
          type: 'run',
          runId: 'r-1',
          runnerId: RUNNER,
          projectId: 'p',
          ticketId: 't',
          chatId: null,
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

  it('says why stopping waits only while a run end is still unreported', async () => {
    let up = false;
    const tracker = fakeTracker([job('r-1', 'MOB-1')]);
    const finishRun = vi.fn(() =>
      up ? Promise.resolve({} as Run) : Promise.reject(new TypeError('fetch failed')),
    );
    const { watcher, log } = watcherWith({ ...tracker.api, finishRun }, exits(0));
    void watcher.lookForWork();
    await vi.waitFor(() =>
      expect(log).toContain("Couldn't tell the tracker how MOB-1 ended yet. Trying again."),
    );
    const stopping = watcher.stop();
    expect(log).toContain(
      'Still telling the tracker how MOB-1 ended. Press Ctrl-C again to quit now.',
    );
    up = true;
    await stopping;
    const idle = watcherWith(fakeTracker([]).api, exits(0));
    await idle.watcher.stop();
    expect(idle.log).toEqual([]);
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
