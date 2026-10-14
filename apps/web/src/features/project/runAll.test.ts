import type { ActivityRun, RunActivity, RunAllResult } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { projectRunCounts, runAllToast, runCountsText } from './runAll';

const run = (projectKey: string, state: ActivityRun['state']): ActivityRun => ({
  runId: `${projectKey}-${state}-${Math.random()}`,
  batchId: null,
  projectKey,
  projectName: projectKey,
  ticketKey: `${projectKey}-1`,
  ticketTitle: 'A ticket',
  state,
  startedAt: null,
  createdAt: 1,
});

const activity = (runs: ActivityRun[]): RunActivity => ({
  runs,
  batches: [],
  runningCount: 0,
  limit: 5,
});

describe('projectRunCounts', () => {
  it('counts the running and waiting runs of one project', () => {
    const runs = [run('MOB', 'running'), run('MOB', 'waiting'), run('MOB', 'waiting')];
    expect(projectRunCounts(activity([...runs, run('WEB', 'running')]), 'MOB')).toEqual({
      running: 1,
      waiting: 2,
    });
  });

  it('leaves out a failed run and counts nothing before the runs load', () => {
    expect(projectRunCounts(activity([run('MOB', 'failed')]), 'MOB')).toEqual({
      running: 0,
      waiting: 0,
    });
    expect(projectRunCounts(undefined, 'MOB')).toEqual({ running: 0, waiting: 0 });
  });
});

describe('runCountsText', () => {
  it('says how many run, how many wait and the limit', () => {
    expect(runCountsText({ running: 2, waiting: 3 }, 5)).toBe('2 running · 3 waiting · limit 5');
  });
});

describe('runAllToast', () => {
  const result = (overrides: Partial<RunAllResult>): RunAllResult => ({
    runId: 'b-1',
    queued: 4,
    skippedActive: 0,
    skippedDevice: 0,
    leftOver: 0,
    maxParallel: 5,
    ...overrides,
  });

  it('says the one batch run it started, for how many tickets and how many at once', () => {
    expect(runAllToast(result({}))).toBe('Started 1 run for 4 tickets, up to 5 at once.');
    expect(runAllToast(result({ queued: 1, maxParallel: 2 }))).toBe(
      'Started 1 run for 1 ticket, up to 2 at once.',
    );
  });

  it('says why tickets were skipped', () => {
    expect(runAllToast(result({ queued: 2, skippedActive: 1, skippedDevice: 1 }))).toBe(
      'Started 1 run for 2 tickets, up to 5 at once. Skipped 1 already running or waiting, 1 needs a device.',
    );
    expect(
      runAllToast(result({ runId: null, queued: 0, skippedActive: 2, skippedDevice: 1 })),
    ).toBe('No tickets to run. Skipped 2 already running or waiting, 1 needs a device.');
  });

  it('says how many wait for the next Run all', () => {
    expect(runAllToast(result({ queued: 30, leftOver: 4 }))).toBe(
      'Started 1 run for 30 tickets, up to 5 at once. 4 more wait for the next Run all.',
    );
  });

  it('says when there was nothing to run', () => {
    expect(runAllToast(result({ runId: null, queued: 0 }))).toBe('No tickets to run.');
  });
});
