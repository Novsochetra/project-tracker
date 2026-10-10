import { randomUUID } from 'node:crypto';
import { RUN_RESTARTED, type Run, type RunJob } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { addUser, caller, helperName } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

// Reviewer 139: a helper that crashed mid-run and came back under the same id kept checking in,
// so its old run stayed running and held the ticket for good.
describe.each(DIALECTS)('regression: a restarted helper ends the run it lost (%s)', (dialect) => {
  const api = useTestServer(dialect);

  it('fails the run it still had when it asks for the next one', async () => {
    const user = await addUser(api.db, 'owner@example.com', Date.now());
    const person = caller(() => api.app, user.person);
    const helper = caller(() => api.app, user.helper);
    const runner = randomUUID();
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await person('POST', '/api/projects/MOB/tickets', { title: 'Crash' });
    await helper('PUT', `/api/runners/${runner}`, helperName('Mac'));
    const lost = await person<Run>('POST', '/api/tickets/MOB-1/runs', {
      runnerId: runner,
      prompt: 'Go',
    });
    await helper<RunJob>('POST', `/api/runners/${runner}/next`);

    await helper('PUT', `/api/runners/${runner}`, helperName('Mac'));
    expect((await helper('POST', `/api/runners/${runner}/next`)).status).toBe(204);
    expect((await person<Run>('GET', `/api/runs/${lost.body.id}`)).body).toMatchObject({
      status: 'failed',
      error: RUN_RESTARTED,
    });
    const again = await person('POST', '/api/tickets/MOB-1/runs', {
      runnerId: runner,
      prompt: 'Go',
    });
    expect(again.status).toBe(201);
  });
});
