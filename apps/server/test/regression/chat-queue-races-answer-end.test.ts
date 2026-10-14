import { randomUUID } from 'node:crypto';
import { CHAT_QUEUE_MAX, type ChatDetail, type Run, type RunJob } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { testClock } from '../helpers/auth';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

const SESSION = '11111111-2222-4333-8444-555555555555';

// Review of PT-234: a send looked at the chat before its transaction and the next queued message
// started only after the answer's end was saved, so a message sent as an answer ended jumped the
// queue (thread [..., B] with A still queued), or got 409 on PGlite. Concurrent sends could also
// pass the cap together.
describe.each(DIALECTS)('regression: sends that race an answer’s end (%s)', (dialect) => {
  const clock = testClock();
  const api = useTestServer(dialect, { now: clock.now });
  const runner = randomUUID();
  let person: Caller;
  let helper: Caller;

  const ask = (chatId: string, text: string) =>
    person<ChatDetail>('POST', `/api/chats/${chatId}/messages`, { runnerId: runner, text });
  const next = () => helper<RunJob | null>('POST', `/api/runners/${runner}/next?kind=ask`);
  const chat = async (id: string) => (await person<ChatDetail>('GET', `/api/chats/${id}`)).body;

  async function working(): Promise<{ chatId: string; job: RunJob }> {
    const started = await person<ChatDetail>('POST', '/api/projects/MOB/chats', {
      runnerId: runner,
      text: 'How does sync work?',
    });
    const job = (await next()).body!;
    clock.advance(1_000);
    return { chatId: started.body.chat.id, job };
  }

  beforeEach(async () => {
    clock.set(1_000_000);
    const owner = await addUser(api.db, 'owner@example.com', clock.now());
    person = caller(() => api.app, owner.person);
    helper = caller(() => api.app, owner.helper);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await helper('PUT', `/api/runners/${runner}`, helperName('Mac'));
  });

  it('keeps the queue in order: the queued message starts and the new ones wait behind it', async () => {
    const { chatId, job } = await working();
    await ask(chatId, 'A');
    const done = { status: 'done', answer: 'Every minute.', sessionId: SESSION };
    const [ended, b, c] = await Promise.all([
      helper<Run>('POST', `/api/runs/${job.run.id}/finish`, done),
      ask(chatId, 'B'),
      ask(chatId, 'C'),
    ]);
    expect([ended.status, b.status, c.status]).toEqual([200, 200, 200]);
    const after = await chat(chatId);
    expect(after.messages.at(-1)?.text).toBe('A');
    expect(after.queued?.map(({ text }) => text).sort()).toEqual(['B', 'C']);
    const runs = await api.db
      .selectFrom('runs')
      .select(['status', 'questionId'])
      .where('chatId', '=', chatId)
      .where('status', '=', 'queued')
      .execute();
    expect(runs.map(({ questionId }) => questionId)).toEqual([after.messages.at(-1)?.id]);
  });

  it(`queues no more than ${CHAT_QUEUE_MAX} when sends come at once`, async () => {
    const { chatId } = await working();
    const sends = await Promise.all(
      Array.from({ length: CHAT_QUEUE_MAX + 3 }, (_, index) => ask(chatId, `C${index}`)),
    );
    expect(sends.filter(({ status }) => status === 200)).toHaveLength(CHAT_QUEUE_MAX);
    expect(sends.filter(({ status }) => status === 409)).toHaveLength(3);
    expect((await chat(chatId)).queued).toHaveLength(CHAT_QUEUE_MAX);
  });
});
