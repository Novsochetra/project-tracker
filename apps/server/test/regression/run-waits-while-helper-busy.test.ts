import { randomUUID } from 'node:crypto';
import { RUN_LOST, HELPER_SILENCE_MS, type Run } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { testClock } from '../helpers/auth';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

const CHECK_IN_MS = 20_000;

// Reviewer 139: the 30 minutes counted from when a run was queued, so the second of two runs on a
// helper busy with the first failed with "Your computer didn't take the run" while the helper was
// online. And a run whose computer died mid-run stayed running, holding its ticket for good.
describe.each(DIALECTS)('regression: a run waits for a busy helper (%s)', (dialect) => {
  const clock = testClock();
  const api = useTestServer(dialect, { now: clock.now });
  const runner = randomUUID();
  let person: Caller;
  let helper: Caller;

  const start = async (ticket: string) =>
    (await person<Run>('POST', `/api/tickets/${ticket}/runs`, { runnerId: runner, prompt: 'Go' }))
      .body;
  const read = async (run: Run) => (await person<Run>('GET', `/api/runs/${run.id}`)).body;
  const checkInFor = async (ms: number) => {
    for (let waited = 0; waited < ms; waited += CHECK_IN_MS) {
      clock.advance(CHECK_IN_MS);
      await helper('PUT', `/api/runners/${runner}`, helperName('Mac'));
    }
  };

  beforeEach(async () => {
    clock.set(Date.now());
    const user = await addUser(api.db, 'owner@example.com', clock.now());
    person = caller(() => api.app, user.person);
    helper = caller(() => api.app, user.helper);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    for (const title of ['Crash', 'Login']) {
      await person('POST', '/api/projects/MOB/tickets', { title });
    }
    await helper('PUT', `/api/runners/${runner}`, helperName('Mac'));
  });

  it('keeps a queued run while its helper checks in, busy with another', async () => {
    const first = await start('MOB-1');
    clock.advance(1);
    const second = await start('MOB-2');
    await helper('POST', `/api/runners/${runner}/next`);
    await checkInFor(HELPER_SILENCE_MS + 60_000);
    expect(await read(first)).toMatchObject({ status: 'running' });
    expect(await read(second)).toMatchObject({ status: 'queued' });
  });

  it('ends a running run once its helper has been silent for the pickup time', async () => {
    const run = await start('MOB-1');
    await helper('POST', `/api/runners/${runner}/next`);
    clock.advance(HELPER_SILENCE_MS);
    expect(await read(run)).toMatchObject({ status: 'failed', error: RUN_LOST });
    const again = await person('POST', '/api/tickets/MOB-1/runs', {
      runnerId: runner,
      prompt: 'Go',
    });
    expect(again.status).toBe(201);
  });
});
