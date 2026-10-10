import { describe, expect, it } from 'vitest';
import { makeRun } from './test/runFixtures';
import { isWorking, runsRefreshMs, WORKING_RUN_REFRESH_MS, workingRun } from './workingRun';

const failed = makeRun({ id: 'r-0', status: 'failed', error: 'Exit 1' });

describe('isWorking', () => {
  it('is true while a run waits or works', () => {
    expect(isWorking(makeRun({ status: 'queued' }))).toBe(true);
    expect(isWorking(makeRun({ status: 'running' }))).toBe(true);
    expect(isWorking(makeRun({ status: 'done' }))).toBe(false);
    expect(isWorking(failed)).toBe(false);
    expect(isWorking(makeRun({ status: 'cancelled' }))).toBe(false);
  });
});

describe('workingRun', () => {
  it('is the latest run while it waits or works', () => {
    const running = makeRun({ status: 'running' });
    expect(workingRun([running, failed])).toBe(running);
    expect(workingRun([failed, running])).toBeUndefined();
    expect(workingRun([])).toBeUndefined();
    expect(workingRun(undefined)).toBeUndefined();
  });
});

describe('runsRefreshMs', () => {
  it('reads the runs again only while the latest one waits or works', () => {
    expect(runsRefreshMs([makeRun({ status: 'queued' })])).toBe(WORKING_RUN_REFRESH_MS);
    expect(runsRefreshMs([makeRun({ status: 'running' }), failed])).toBe(WORKING_RUN_REFRESH_MS);
    expect(runsRefreshMs([failed, makeRun({ status: 'running' })])).toBe(false);
    expect(runsRefreshMs(undefined)).toBe(false);
  });
});
