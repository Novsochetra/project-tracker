import { randomUUID } from 'node:crypto';
import type { ChatDetail, Run, RunJob } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { testClock } from '../helpers/auth';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

const SESSION = '11111111-2222-4333-8444-555555555555';

// Review of PT-234: a queue held after Stop started by itself once a later message was answered.
// Held messages wait for Send now; a new message runs at once, and messages queued behind it start
// as usual, skipping the held ones.
describe.each(DIALECTS)('regression: a held queue stays held (%s)', (dialect) => {
  const clock = testClock();
  const api = useTestServer(dialect, { now: clock.now });
  const runner = randomUUID();
  let person: Caller;
  let helper: Caller;

  const ask = (chatId: string, text: string) =>
    person<ChatDetail>('POST', `/api/chats/${chatId}/messages`, { runnerId: runner, text });
  const next = () => helper<RunJob | null>('POST', `/api/runners/${runner}/next?kind=ask`);
  const answer = (job: RunJob | null, text: string) =>
    helper<Run>('POST', `/api/runs/${job?.run.id ?? ''}/finish`, {
      status: 'done',
      answer: text,
      sessionId: SESSION,
    });
  const queuedOf = async (id: string) =>
    (await person<ChatDetail>('GET', `/api/chats/${id}`)).body.queued?.map(({ text, held }) => [
      text,
      held,
    ]);

  beforeEach(async () => {
    clock.set(1_000_000);
    const owner = await addUser(api.db, 'owner@example.com', clock.now());
    person = caller(() => api.app, owner.person);
    helper = caller(() => api.app, owner.helper);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await helper('PUT', `/api/runners/${runner}`, helperName('Mac'));
  });

  it.each([
    ['stopped', (job: RunJob) => person('POST', `/api/runs/${job.run.id}/cancel`)],
    [
      'failed',
      (job: RunJob) =>
        helper('POST', `/api/runs/${job.run.id}/finish`, { status: 'failed', error: 'x' }),
    ],
  ])('keeps messages queued before a %s answer for Send now', async (_name, end) => {
    const started = await person<ChatDetail>('POST', '/api/projects/MOB/chats', {
      runnerId: runner,
      text: 'How does sync work?',
    });
    const chatId = started.body.chat.id;
    const first = (await next()).body!;
    clock.advance(1_000);
    await ask(chatId, 'Held?');
    clock.advance(1_000);
    await end(first);
    expect(await queuedOf(chatId)).toEqual([['Held?', true]]);

    clock.advance(1_000);
    const direct = await ask(chatId, 'New direction');
    expect(direct.body.run?.status).toBe('queued');
    expect(direct.body.messages.at(-1)?.text).toBe('New direction');
    const second = (await next()).body;
    clock.advance(1_000);
    await ask(chatId, 'Then this');
    expect(await queuedOf(chatId)).toEqual([
      ['Held?', true],
      ['Then this', false],
    ]);

    clock.advance(1_000);
    await answer(second, 'Done.');
    const third = (await next()).body;
    expect(third?.prompt).toContain('Then this');
    expect(third?.prompt).not.toContain('Held?');
    clock.advance(1_000);
    await answer(third, 'Done too.');
    expect((await next()).status).toBe(204);
    expect(await queuedOf(chatId)).toEqual([['Held?', true]]);
  });
});
