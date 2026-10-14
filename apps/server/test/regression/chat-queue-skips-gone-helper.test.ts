import { randomUUID } from 'node:crypto';
import type { ChatDetail, Run, RunJob } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { testClock } from '../helpers/auth';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

// Review of PT-234: a queued message whose helper was removed stalled every message behind it.
describe.each(DIALECTS)('regression: the queue skips a message its helper left (%s)', (dialect) => {
  const clock = testClock();
  const api = useTestServer(dialect, { now: clock.now });
  const mac = randomUUID();
  const studio = randomUUID();
  let person: Caller;
  let helper: Caller;

  beforeEach(async () => {
    clock.set(1_000_000);
    const owner = await addUser(api.db, 'owner@example.com', clock.now());
    person = caller(() => api.app, owner.person);
    helper = caller(() => api.app, owner.helper);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await helper('PUT', `/api/runners/${mac}`, helperName('Mac'));
    await helper('PUT', `/api/runners/${studio}`, helperName('Studio'));
  });

  it('starts the next message on a helper that is still there', async () => {
    const started = await person<ChatDetail>('POST', '/api/projects/MOB/chats', {
      runnerId: mac,
      text: 'How does sync work?',
    });
    const chatId = started.body.chat.id;
    const job = (await helper<RunJob | null>('POST', `/api/runners/${mac}/next?kind=ask`)).body!;
    clock.advance(1_000);
    await person('POST', `/api/chats/${chatId}/messages`, { runnerId: studio, text: 'On Studio' });
    clock.advance(1_000);
    await person('POST', `/api/chats/${chatId}/messages`, { runnerId: mac, text: 'On Mac' });
    await person('DELETE', `/api/runners/${studio}`);

    await helper<Run>('POST', `/api/runs/${job.run.id}/finish`, { status: 'done', answer: 'x' });

    const chat = (await person<ChatDetail>('GET', `/api/chats/${chatId}`)).body;
    expect(chat.run?.id).not.toBe(job.run.id);
    expect(chat.messages.at(-1)?.text).toBe('On Mac');
    expect(chat.queued?.map(({ text }) => text)).toEqual(['On Studio']);
  });
});
