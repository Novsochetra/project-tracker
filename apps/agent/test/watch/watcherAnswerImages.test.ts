import type { FinishRunInput } from '@tracker/shared';
import { describe, expect, it, vi } from 'vitest';
import { createWatcher } from '../../src/watch/watcher';
import { answered, askJob, fakeTracker, RUNNER } from './fakeTracker';

const SESSION = '11111111-2222-4333-8444-555555555555';
const SETTINGS = { runnerId: RUNNER, name: 'Mac', projectKey: 'MOB', trackerUrl: 'http://x.test' };

describe('the watcher with pictures in an answer (PT-225)', () => {
  it("sends the pictures' ids with the answer it ends the run with", async () => {
    const tracker = fakeTracker([askJob('r-1', 'c0ffee00-chat', SESSION)]);
    const runAsk = vi.fn(() => Promise.resolve(answered('See the screen.', SESSION)));
    const answerImages = vi.fn((outcome: FinishRunInput) =>
      Promise.resolve({ ...outcome, attachmentIds: ['a-1'] }),
    );
    const watcher = createWatcher(
      { api: tracker.api, runClaude: vi.fn(), runAsk, answerImages, log: () => undefined },
      SETTINGS,
    );
    await watcher.lookForWork();
    expect(answerImages).toHaveBeenCalledWith(
      { status: 'done', answer: 'See the screen.', sessionId: SESSION },
      expect.any(AbortSignal),
      undefined,
    );
    expect(tracker.ended).toEqual([
      {
        id: 'r-1',
        status: 'done',
        answer: 'See the screen.',
        sessionId: SESSION,
        attachmentIds: ['a-1'],
      },
    ]);
  });
});
