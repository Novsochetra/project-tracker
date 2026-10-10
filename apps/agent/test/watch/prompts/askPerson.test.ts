import { ApiError } from '@tracker/client';
import type { AddRunRequestInput, RunRequest } from '@tracker/shared';
import { describe, expect, it, vi } from 'vitest';
import { createAskPerson, type AskPersonDeps } from '../../../src/watch/prompts/askPerson';
import { NO_ANSWER, RUN_ENDED, UNREACHABLE, UNSHOWN } from '../../../src/watch/prompts/decisionOf';
import { job, RUNNER } from '../fakeTracker';
import { permissionRequest } from './requests';

const FOLDER = '/Users/dara/app';
const run = job('r-1', 'MOB-1').run;
const bash = { toolName: 'Bash', input: { command: 'npm test' } };

function setup(waits: (() => Promise<RunRequest>)[], changes: Partial<AskPersonDeps> = {}) {
  const log: string[] = [];
  const asked: AddRunRequestInput[] = [];
  const api: AskPersonDeps['api'] = {
    addRunRequest: vi.fn((_runId: string, input: AddRunRequestInput) => {
      asked.push(input);
      return Promise.resolve(permissionRequest());
    }),
    waitForRunRequest: vi.fn((_id: string, { signal }: { signal?: AbortSignal } = {}) => {
      const next = waits.shift();
      if (next) return next();
      return new Promise<never>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    }),
  };
  const ask = createAskPerson({
    api,
    runnerId: RUNNER,
    folder: FOLDER,
    log: (text) => log.push(text),
    describe: (error) => (error instanceof Error ? error.message : String(error)),
    retryDelay: () => 1,
    ...changes,
  });
  return { ask, api, log, asked };
}

const answered = (decision: 'allow' | 'deny') => () =>
  Promise.resolve(permissionRequest({ status: 'answered', decision }));
const stillOpen = () => Promise.resolve(permissionRequest());
const signal = () => new AbortController().signal;

describe('asking the person', () => {
  it('sends only the label, waits through open answers and allows what the person allowed', async () => {
    const { ask, asked, log } = setup([stillOpen, stillOpen, answered('allow')]);
    expect(await ask(run, bash, signal())).toEqual({ behavior: 'allow', updatedInput: bash.input });
    expect(asked).toEqual([
      { runnerId: RUNNER, kind: 'permission', label: 'Run npm test', questions: null },
    ]);
    expect(log).toEqual([
      'MOB-1: Claude asks on the phone: Run npm test',
      'MOB-1: the person answered.',
    ]);
  });

  it('denies at once when the tracker takes no request', async () => {
    const { ask, api, log } = setup([]);
    vi.mocked(api.addRunRequest).mockRejectedValueOnce(new ApiError(409, 'conflict', 'Ended.'));
    expect(await ask(run, bash, signal())).toEqual({ behavior: 'deny', message: UNREACHABLE });
    expect(log).toEqual(["Couldn't ask on the phone for MOB-1: Ended."]);
  });

  it('denies a question with nothing to show without asking', async () => {
    const { ask, api } = setup([]);
    const call = { toolName: 'AskUserQuestion', input: { questions: [] } };
    expect(await ask(run, call, signal())).toEqual({ behavior: 'deny', message: UNSHOWN });
    expect(api.addRunRequest).not.toHaveBeenCalled();
  });

  it('keeps waiting through a tracker that comes and goes', async () => {
    const down = () => Promise.reject(new Error('fetch failed'));
    const { ask, log } = setup([down, down, answered('deny')]);
    expect(await ask(run, bash, signal())).toMatchObject({ behavior: 'deny' });
    expect(log).toContain('Waiting for the tracker: fetch failed');
    expect(log.filter((line) => line.startsWith('Waiting'))).toHaveLength(1);
  });

  it('ends the wait itself past the deadline when the tracker stays away', async () => {
    let now = 0;
    const down = () => {
      now += 1_000_000;
      return Promise.reject(new Error('fetch failed'));
    };
    const { ask, log } = setup([down, down, down, down], { now: () => now });
    expect(await ask(run, bash, signal())).toEqual({ behavior: 'deny', message: NO_ANSWER });
    expect(log.at(-1)).toBe('MOB-1: nobody answered in time.');
  });

  it('stops waiting when the run stops', async () => {
    const { ask, api } = setup([]);
    const stop = new AbortController();
    const asking = ask(run, bash, stop.signal);
    await vi.waitFor(() => expect(api.waitForRunRequest).toHaveBeenCalled());
    stop.abort();
    expect(await asking).toEqual({ behavior: 'deny', message: RUN_ENDED });
    const [, options] = vi.mocked(api.waitForRunRequest).mock.calls[0]!;
    expect(options?.signal?.aborted).toBe(true);
  });
});
