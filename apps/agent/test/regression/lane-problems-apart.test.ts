import type { RunKind } from '@tracker/shared';
import { describe, expect, it, vi } from 'vitest';
import { createWatcher } from '../../src/watch/watcher';
import { fakeTracker, noAsks, RUNNER } from '../watch/fakeTracker';

// The two lanes shared one problem, so the ticket lane's empty take said the tracker was back
// while the ask lane still failed, and the next round said the failure again (PT-158).
describe('regression: one lane fails while the other takes runs', () => {
  it('keeps the failure on screen until that lane is fine again', async () => {
    let askDown = true;
    const tracker = fakeTracker([]);
    const api = {
      ...tracker.api,
      takeNextRun: vi.fn((_runnerId: string, kind: RunKind) =>
        kind === 'ask' && askDown
          ? Promise.reject(new Error('ask lane broke'))
          : Promise.resolve(null),
      ),
    };
    const log: string[] = [];
    const watcher = createWatcher(
      { api, runClaude: noAsks, runAsk: noAsks, log: (text) => log.push(text) },
      { runnerId: RUNNER, name: 'Mac', projectKey: 'MOB', trackerUrl: 'http://tracker.test' },
    );
    await watcher.lookForWork();
    await watcher.checkIn();
    await watcher.lookForWork();
    expect(log).toHaveLength(1);
    expect(log[0]).toContain('ask lane broke');
    askDown = false;
    await watcher.lookForWork();
    expect(log).toEqual([log[0], 'In touch with the tracker again.']);
  });
});
