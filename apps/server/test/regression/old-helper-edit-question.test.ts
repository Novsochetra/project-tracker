import { randomUUID } from 'node:crypto';
import type { ChatDetail, Run, RunJob } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

// PT-160 review: a helper built before asks names no lane and got an Edit question in the ticket
// lane. It throws on a run with no ticket, so the question ended "restarted" instead of waiting.
describe.each(DIALECTS)('regression: an old helper and an Edit question (%s)', (dialect) => {
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

  it('never hands it the question, which waits for a helper that names its lane', async () => {
    const chat = await person<ChatDetail>('POST', '/api/projects/MOB/chats', {
      runnerId: runner,
      text: 'Fix the crash',
      mode: 'edit',
    });

    expect((await helper('POST', `/api/runners/${runner}/next`)).status).toBe(204);
    const run = await person<Run>('GET', `/api/runs/${chat.body.run?.id ?? ''}`);
    expect(run.body.status).toBe('queued');
    const taken = await helper<RunJob>('POST', `/api/runners/${runner}/next?kind=ticket`);
    expect(taken.body.run.id).toBe(chat.body.run?.id);
  });
});
