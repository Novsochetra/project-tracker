import { ApiError } from '@tracker/client';
import type { AddRunRequestInput, RunRequest } from '@tracker/shared';
import { describe, expect, it, vi } from 'vitest';
import { createAskPerson, type AskPersonDeps } from '../../../src/watch/prompts/askPerson';
import { NO_ANSWER, RUN_ENDED, UNSHOWN } from '../../../src/watch/prompts/decisionOf';
import { CALL_CLOSED, RUN_STOPPED } from '../../../src/watch/prompts/promptSocket';
import {
  HELPER_REFUSED,
  NOT_RUNNING,
  RUN_GONE,
  UNREACHABLE,
} from '../../../src/watch/prompts/trackerRefusal';
import { job, RUNNER } from '../fakeTracker';
import { permissionRequest } from './requests';

const FOLDER = '/Users/dara/app';
const run = job('r-1', 'MOB-1').run;
const bash = { toolName: 'Bash', input: { command: 'npm test' } };

type Waited = () => Promise<RunRequest>;

const untilAborted = (signal?: AbortSignal) =>
  new Promise<never>((_resolve, reject) => {
    signal?.addEventListener('abort', () => reject(new Error('aborted')));
  });

function setup(waits: Waited[], changes: Partial<AskPersonDeps> = {}) {
  const log: string[] = [];
  const asked: AddRunRequestInput[] = [];
  const api: AskPersonDeps['api'] = {
    addRunRequest: vi.fn((_runId: string, input: AddRunRequestInput) => {
      asked.push(input);
      return Promise.resolve(permissionRequest());
    }),
    waitForRunRequest: vi.fn((_id: string, { signal }: { signal?: AbortSignal } = {}) => {
      const next = waits.shift();
      return next ? next() : untilAborted(signal);
    }),
    cancelRunRequest: vi.fn(() => Promise.resolve(permissionRequest({ status: 'cancelled' }))),
  };
  const ask = createAskPerson({
    api,
    runnerId: RUNNER,
    folder: FOLDER,
    log: (text) => log.push(text),
    describe: (error) => (error instanceof Error ? error.message : String(error)),
    now: () => 0,
    retryDelay: () => 1,
    ...changes,
  });
  return { ask, api, log, asked };
}

const answered = (decision: 'allow' | 'deny') => () =>
  Promise.resolve(permissionRequest({ status: 'answered', decision }));
const stillOpen = () => Promise.resolve(permissionRequest());
const refused = (status: number) => () =>
  Promise.reject(new ApiError(status, 'refused', 'Refused.'));
const signal = () => new AbortController().signal;
const cancelled = (api: AskPersonDeps['api']) =>
  vi.mocked(api.cancelRunRequest).mock.calls.map(([id, input]) => [id, input]);

describe('asking the person', () => {
  it('sends only the label, waits through open answers and allows what the person allowed', async () => {
    const { ask, api, asked, log } = setup([stillOpen, stillOpen, answered('allow')]);
    expect(await ask(run, bash, signal())).toEqual({ behavior: 'allow', updatedInput: bash.input });
    expect(asked).toEqual([
      {
        runnerId: RUNNER,
        kind: 'permission',
        label: 'Run npm test',
        labelCut: false,
        questions: null,
      },
    ]);
    expect(log).toEqual([
      'MOB-1: Claude asks on the phone: Run npm test',
      'MOB-1: the person answered.',
    ]);
    expect(api.cancelRunRequest).not.toHaveBeenCalled();
  });

  it.each([
    [409, NOT_RUNNING],
    [404, RUN_GONE],
    [401, HELPER_REFUSED],
    [403, HELPER_REFUSED],
    [500, UNREACHABLE],
  ])('says why when the tracker takes no request (%i)', async (status, message) => {
    const { ask, api, log } = setup([]);
    vi.mocked(api.addRunRequest).mockRejectedValueOnce(new ApiError(status, 'x', 'Nope.'));
    expect(await ask(run, bash, signal())).toEqual({ behavior: 'deny', message });
    expect(log).toEqual(["Couldn't ask on the phone for MOB-1: Nope."]);
  });

  it('says so when the tracker is not there at all', async () => {
    const { ask, api } = setup([]);
    vi.mocked(api.addRunRequest).mockRejectedValueOnce(new TypeError('fetch failed'));
    expect(await ask(run, bash, signal())).toEqual({ behavior: 'deny', message: UNREACHABLE });
  });

  it('denies a question with nothing to show without asking', async () => {
    const { ask, api } = setup([]);
    const call = { toolName: 'AskUserQuestion', input: { questions: [] } };
    expect(await ask(run, call, signal())).toEqual({ behavior: 'deny', message: UNSHOWN });
    expect(api.addRunRequest).not.toHaveBeenCalled();
  });

  it('keeps waiting through a tracker that comes and goes', async () => {
    const down = () => Promise.reject(new TypeError('fetch failed'));
    const { ask, log } = setup([down, refused(502), answered('deny')]);
    expect(await ask(run, bash, signal())).toMatchObject({ behavior: 'deny' });
    expect(log.filter((line) => line.startsWith('Waiting'))).toEqual([
      'Waiting for the tracker: fetch failed',
    ]);
  });

  it.each([
    [404, RUN_GONE],
    [401, HELPER_REFUSED],
    [403, HELPER_REFUSED],
  ])('stops waiting at once when the tracker refuses (%i)', async (status, message) => {
    const { ask, api } = setup([stillOpen, refused(status), answered('allow')]);
    expect(await ask(run, bash, signal())).toEqual({ behavior: 'deny', message });
    expect(api.waitForRunRequest).toHaveBeenCalledTimes(2);
    expect(cancelled(api)).toEqual([['q-1', { runnerId: RUNNER }]]);
  });

  it('ends the request itself past the deadline when the tracker stays away', async () => {
    let now = 0;
    const down = () => {
      now += 1_000_000;
      return Promise.reject(new TypeError('fetch failed'));
    };
    const { ask, api, log } = setup([down, down, down, down], { now: () => now });
    expect(await ask(run, bash, signal())).toEqual({ behavior: 'deny', message: NO_ANSWER });
    expect(log.at(-1)).toBe(`MOB-1: stopped waiting: ${NO_ANSWER}`);
    expect(cancelled(api)).toEqual([['q-1', { runnerId: RUNNER }]]);
  });

  it.each([
    [RUN_STOPPED, 'MOB-1: the run stopped before an answer.'],
    [CALL_CLOSED, 'MOB-1: Claude stopped waiting for an answer.'],
  ])('ends the request on the tracker when the wait stops (%s)', async (reason, line) => {
    const { ask, api, log } = setup([]);
    const stop = new AbortController();
    const asking = ask(run, bash, stop.signal);
    await vi.waitFor(() => expect(api.waitForRunRequest).toHaveBeenCalled());
    stop.abort(reason);
    expect(await asking).toEqual({ behavior: 'deny', message: RUN_ENDED });
    const [, options] = vi.mocked(api.waitForRunRequest).mock.calls[0]!;
    expect(options?.signal?.aborted).toBe(true);
    expect(cancelled(api)).toEqual([['q-1', { runnerId: RUNNER }]]);
    expect(log.at(-1)).toBe(line);
  });

  it('still answers Claude when the tracker cannot take the end', async () => {
    const { ask, api } = setup([refused(404)]);
    vi.mocked(api.cancelRunRequest).mockRejectedValueOnce(new ApiError(404, 'x', 'Gone.'));
    expect(await ask(run, bash, signal())).toEqual({ behavior: 'deny', message: RUN_GONE });
  });
});
