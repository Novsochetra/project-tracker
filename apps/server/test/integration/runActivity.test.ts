import { randomUUID } from 'node:crypto';
import { DEFAULT_MAX_PARALLEL_RUNS, type Run, type RunActivity } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

describe.each(DIALECTS)('run activity (%s)', (dialect) => {
  const api = useTestServer(dialect);
  let person: Caller;
  let helper: Caller;
  let other: Caller;
  const runner = randomUUID();

  const start = (ticket: string) =>
    person<Run>('POST', `/api/tickets/${ticket}/runs`, {
      runnerId: runner,
      prompt: `Do ${ticket}`,
    });

  beforeEach(async () => {
    const mine = await addUser(api.db, 'a@example.com', Date.now());
    const theirs = await addUser(api.db, 'b@example.com', Date.now() + 1);
    person = caller(() => api.app, mine.person);
    helper = caller(() => api.app, mine.helper);
    other = caller(() => api.app, theirs.person);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await person('POST', '/api/projects', { name: 'Web', key: 'WEB' });
    await other('POST', '/api/projects', { name: 'Secret', key: 'SEC' });
    await other('POST', '/api/projects/SEC/tickets', { title: 'Hidden' });
    for (const title of ['Crash', 'Login']) {
      await person('POST', '/api/projects/MOB/tickets', { title });
    }
    await person('POST', '/api/projects/WEB/tickets', { title: 'Search' });
    await helper('PUT', `/api/runners/${runner}`, {
      ...helperName('A Mac'),
      projectKeys: ['MOB', 'WEB'],
    });
  });

  it('lists active runs from every project with the running count and the limit', async () => {
    await start('MOB-1');
    await start('WEB-1');
    await helper('POST', `/api/runners/${runner}/next`);
    const { status, body } = await person<RunActivity>('GET', '/api/run-activity');
    expect(status).toBe(200);
    expect(body.limit).toBe(DEFAULT_MAX_PARALLEL_RUNS);
    expect(body.runningCount).toBe(1);
    expect(body.runs).toMatchObject([
      { ticketKey: 'WEB-1', ticketTitle: 'Search', projectName: 'Web', state: 'waiting' },
      { ticketKey: 'MOB-1', ticketTitle: 'Crash', projectName: 'Mobile', state: 'running' },
    ]);
  });

  it('shows a failed run and leaves out a cancelled one', async () => {
    const failing = (await start('MOB-1')).body;
    await helper('POST', `/api/runners/${runner}/next`);
    await helper('POST', `/api/runs/${failing.id}/finish`, { status: 'failed', error: 'Broke' });
    const cancelled = (await start('MOB-2')).body;
    await person('POST', `/api/runs/${cancelled.id}/cancel`);
    const { body } = await person<RunActivity>('GET', '/api/run-activity');
    expect(body.runs).toMatchObject([{ ticketKey: 'MOB-1', state: 'failed' }]);
    expect(body.runningCount).toBe(0);
  });

  it("never shows another user's runs", async () => {
    await start('MOB-1');
    const theirs = (await other<RunActivity>('GET', '/api/run-activity')).body;
    expect(theirs.runs).toEqual([]);
    const mine = (await person<RunActivity>('GET', '/api/run-activity')).body;
    expect(mine.runs.map((run) => run.ticketKey)).toEqual(['MOB-1']);
  });
});
