import { describe, expect, it, vi } from 'vitest';
import { deferred } from '../../api/test/deferred';
import type { SyncReport } from './syncCaptures';
import { claimCapture, runCaptureSync, trackSending } from './syncRunner';

const REPORT: SyncReport = { added: [], dropped: [], stopped: false };

describe('runCaptureSync', () => {
  it('joins a sync that is already running instead of starting another', async () => {
    const answer = deferred<SyncReport>();
    const run = vi.fn(() => answer.promise);

    const first = runCaptureSync(run);
    const second = runCaptureSync(run);
    answer.resolve(REPORT);

    await expect(first).resolves.toBe(REPORT);
    await expect(second).resolves.toBe(REPORT);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('starts a new sync once the last one finished, even after a failure', async () => {
    const run = vi.fn(() => Promise.reject(new Error('boom')));
    await expect(runCaptureSync(run)).rejects.toThrow('boom');
    const next = vi.fn(() => Promise.resolve(REPORT));
    await expect(runCaptureSync(next)).resolves.toBe(REPORT);
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('trackSending', () => {
  it('keeps syncs from claiming a capture while its request is out', async () => {
    const untrack = trackSending('a');
    await expect(claimCapture('a')).resolves.toBeNull();
    untrack();
    const claimed = await claimCapture('a');
    expect(claimed).toBeTypeOf('function');
    claimed?.();
  });
});
