import { randomUUID } from 'node:crypto';
import type { ChatDetail, Run, RunJob } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

// PT-222: an Auto question changes the folder like Edit, so it waits in the ticket lane, not the ask lane.
describe.each(DIALECTS)('regression: an Auto question lane (%s)', (dialect) => {
  const api = useTestServer(dialect);
  const runner = randomUUID();
  let person: Caller;
  let helper: Caller;

  beforeEach(async () => {
    const owner = await addUser(api.db, 'owner@example.com', Date.now());
    person = caller(() => api.app, owner.person);
    helper = caller(() => api.app, owner.helper);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await helper('PUT', `/api/runners/${runner}`, helperName('Mac'));
  });

  it('hands it to the ticket lane and never to the ask lane', async () => {
    const chat = await person<ChatDetail>('POST', '/api/projects/MOB/chats', {
      runnerId: runner,
      text: 'Fix the crash',
      mode: 'auto',
    });

    expect((await helper('POST', `/api/runners/${runner}/next?kind=ask`)).status).toBe(204);
    const run = await person<Run>('GET', `/api/runs/${chat.body.run?.id ?? ''}`);
    expect(run.body.status).toBe('queued');
    const taken = await helper<RunJob>('POST', `/api/runners/${runner}/next?kind=ticket`);
    expect(taken.body.run.id).toBe(chat.body.run?.id);
  });
});
