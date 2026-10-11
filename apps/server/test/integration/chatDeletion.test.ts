import { randomUUID } from 'node:crypto';
import type { Chat, ChatDetail, Run, RunJob } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { testClock } from '../helpers/auth';
import { addUser, caller, helperName, type Auth, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

const CARD = [
  'Here it is.',
  '````ticket',
  'title: Keep me',
  'priority: low',
  '---',
  'Why.',
  '````',
];

type Reader = ReadableStreamDefaultReader<Uint8Array>;

async function readUntil(reader: Reader, pattern: RegExp): Promise<string> {
  const decoder = new TextDecoder();
  let text = '';
  while (!pattern.test(text)) {
    const chunk = await reader.read();
    if (chunk.done) throw new Error(`Stream ended before ${String(pattern)}: ${text}`);
    text += decoder.decode(chunk.value, { stream: true });
  }
  return text;
}

describe.each(DIALECTS)('deleting a chat (%s)', (dialect) => {
  const clock = testClock();
  const api = useTestServer(dialect, { now: clock.now });
  const runner = randomUUID();
  let person: Caller;
  let helper: Caller;
  let helperAuth: Auth;
  const readers: Reader[] = [];

  afterEach(async () => {
    await Promise.all(readers.splice(0).map((reader) => reader.cancel()));
  });

  async function helperEvents(): Promise<Reader> {
    const headers = { authorization: `Bearer ${helperAuth.token ?? ''}` };
    const reader = (await api.app.request('/api/events', { headers })).body!.getReader();
    readers.push(reader);
    await readUntil(reader, /: connected\n\n/);
    return reader;
  }

  const startChat = (text: string) =>
    person<ChatDetail>('POST', '/api/projects/MOB/chats', { runnerId: runner, text });
  const next = () => helper<RunJob | null>('POST', `/api/runners/${runner}/next?kind=ask`);
  const finish = (id: string, body: unknown) => helper<Run>('POST', `/api/runs/${id}/finish`, body);
  const remove = (id: string, as: Caller = person) => as('DELETE', `/api/chats/${id}`);

  async function answered(answer: string) {
    const started = await startChat('Question');
    const job = (await next()).body;
    clock.advance(1_000);
    await finish(job?.run.id ?? '', { status: 'done', answer });
    return started.body.chat.id;
  }

  beforeEach(async () => {
    clock.set(1_000_000);
    const owner = await addUser(api.db, 'owner@example.com', clock.now());
    person = caller(() => api.app, owner.person);
    helper = caller(() => api.app, owner.helper);
    helperAuth = owner.helper;
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await helper('PUT', `/api/runners/${runner}`, helperName('Dara’s MacBook'));
  });

  it('removes the chat with its messages and runs, and keeps tickets made from it', async () => {
    const chatId = await answered(CARD.join('\n'));
    const answer = (await person<ChatDetail>('GET', `/api/chats/${chatId}`)).body.messages[1];
    const card = { title: 'Keep me', description: 'Why.', priority: 'low' };
    await person('POST', `/api/chats/${chatId}/messages/${answer?.id}/ticket`, card);
    expect((await remove(chatId)).status).toBe(204);
    expect((await person('GET', `/api/chats/${chatId}`)).status).toBe(404);
    expect((await person<Chat[]>('GET', '/api/projects/MOB/chats')).body).toEqual([]);
    expect((await person('GET', '/api/tickets/MOB-1')).status).toBe(200);
    expect((await remove(chatId)).status).toBe(404);
  });

  it('cancels the answer Claude is working on, so the helper stops it', async () => {
    const chatId = (await startChat('Long question')).body.chat.id;
    const job = (await next()).body;
    const events = await helperEvents();
    expect((await remove(chatId)).status).toBe(204);
    await readUntil(events, new RegExp(`"runId":"${job?.run.id}","[^}]+"cancelled"`));
    expect((await finish(job?.run.id ?? '', { status: 'done', answer: 'Late' })).status).toBe(404);
    expect((await next()).body).toBeNull();
  });

  it('lets only the person who owns the chat delete it', async () => {
    const chatId = await answered('Yes.');
    const other = await addUser(api.db, 'other@example.com', clock.now());
    expect(
      (
        await remove(
          chatId,
          caller(() => api.app, other.person),
        )
      ).status,
    ).toBe(404);
    expect((await remove(chatId, helper)).status).toBe(403);
    expect((await person('GET', `/api/chats/${chatId}`)).status).toBe(200);
  });
});
