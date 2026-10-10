import { randomUUID } from 'node:crypto';
import type { ChatDetail, Run, RunJob } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { testClock } from '../helpers/auth';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

// A helper takes one run at a time per lane. With a single lane, a question waited for the whole
// ticket run, and taking it ended that run as "restarted" (PT-156 review).
describe.each(DIALECTS)('regression: a ticket run and a question on one helper (%s)', (dialect) => {
  const clock = testClock();
  const api = useTestServer(dialect, { now: clock.now });
  const runner = randomUUID();
  let person: Caller;
  let helper: Caller;

  const next = (kind?: string) =>
    helper<RunJob | null>('POST', `/api/runners/${runner}/next${kind ? `?kind=${kind}` : ''}`);

  beforeEach(async () => {
    clock.set(1_000_000);
    const owner = await addUser(api.db, 'owner@example.com', clock.now());
    person = caller(() => api.app, owner.person);
    helper = caller(() => api.app, owner.helper);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await person('POST', '/api/projects/MOB/tickets', { title: 'Crash' });
    await helper('PUT', `/api/runners/${runner}`, helperName('Mac'));
  });

  it('takes the question beside the running ticket run, which keeps running', async () => {
    const ticketRun = await person<Run>('POST', '/api/tickets/MOB-1/runs', {
      runnerId: runner,
      prompt: 'Fix MOB-1',
    });
    expect((await next('ticket')).body?.run.id).toBe(ticketRun.body.id);
    const chat = await person<ChatDetail>('POST', '/api/projects/MOB/chats', {
      runnerId: runner,
      text: 'Where is the crash?',
    });

    const ask = await next('ask');
    expect(ask.body?.run.id).toBe(chat.body.run?.id);
    expect((await person<Run>('GET', `/api/runs/${ticketRun.body.id}`)).body.status).toBe(
      'running',
    );
  });

  it('gives a helper that names no lane only ticket runs, as before asks existed', async () => {
    await person('POST', '/api/projects/MOB/chats', { runnerId: runner, text: 'Where?' });
    expect((await next()).status).toBe(204);
  });
});
