import { randomUUID } from 'node:crypto';
import type { Chat, ChatDetail, RunJob } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { testClock } from '../helpers/auth';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

describe.each(DIALECTS)('a chat about a ticket (%s)', (dialect) => {
  const clock = testClock();
  const api = useTestServer(dialect, { now: clock.now });
  const runner = randomUUID();
  let person: Caller;
  let helper: Caller;

  const startChat = (text: string, ticketKey: string) =>
    person<ChatDetail>('POST', '/api/projects/MOB/chats', { runnerId: runner, text, ticketKey });
  const nextPrompt = async () =>
    (await helper<RunJob | null>('POST', `/api/runners/${runner}/next?kind=ask`)).body?.prompt ??
    '';
  const chat = async (id: string) => (await person<ChatDetail>('GET', `/api/chats/${id}`)).body;
  const listed = async () => (await person<Chat[]>('GET', '/api/projects/MOB/chats')).body;

  async function answer(): Promise<void> {
    const job = (await helper<RunJob | null>('POST', `/api/runners/${runner}/next?kind=ask`)).body;
    clock.advance(1_000);
    await helper('POST', `/api/runs/${job?.run.id ?? ''}/finish`, {
      status: 'done',
      answer: 'Because of the cache.',
      sessionId: randomUUID(),
    });
  }

  beforeEach(async () => {
    clock.set(1_000_000);
    const owner = await addUser(api.db, 'owner@example.com', clock.now());
    person = caller(() => api.app, owner.person);
    helper = caller(() => api.app, owner.helper);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await person('POST', '/api/projects', { name: 'Web', key: 'WEB' });
    await helper('PUT', `/api/runners/${runner}`, helperName('Dara’s MacBook'));
    await person('POST', '/api/projects/MOB/tickets', {
      title: 'Sync drops edits',
      description: 'Edits made offline vanish.',
    });
    await person('POST', '/api/tickets/MOB-1/comments', { text: 'Seen on iOS only' });
    await person('POST', '/api/projects/WEB/tickets', { title: 'Elsewhere' });
  });

  it('starts a chat that names the ticket and sends its context with the first question', async () => {
    const started = await startChat('Why does it drop them?', 'mob-1');
    expect(started.status).toBe(201);
    const ticket = { key: 'MOB-1', title: 'Sync drops edits' };
    expect(started.body.chat.ticket).toEqual(ticket);
    expect((await listed()).map((item) => item.ticket)).toEqual([ticket]);

    const prompt = await nextPrompt();
    expect(prompt).toContain('This chat is about this ticket:\n\n## MOB-1: Sync drops edits');
    expect(prompt).toContain('Edits made offline vanish.');
    expect(prompt).toContain('- Seen on iOS only');
    expect(prompt.endsWith('Question:\nWhy does it drop them?')).toBe(true);
  });

  it('sends the ticket as it is now with every later question', async () => {
    const chatId = (await startChat('Why?', 'MOB-1')).body.chat.id;
    await answer();
    await person('PATCH', '/api/tickets/MOB-1', { title: 'Sync drops offline edits' });
    await person('POST', `/api/chats/${chatId}/messages`, { runnerId: runner, text: 'Where?' });
    expect(await nextPrompt()).toContain('## MOB-1: Sync drops offline edits');
    expect((await chat(chatId)).chat.ticket?.title).toBe('Sync drops offline edits');
  });

  it('refuses a ticket of another project or none, and makes no chat', async () => {
    expect((await startChat('Why?', 'WEB-1')).status).toBe(404);
    expect((await startChat('Why?', 'MOB-9')).status).toBe(404);
    expect((await startChat('Why?', 'not a key')).status).toBe(404);
    expect(await listed()).toEqual([]);
  });

  it('keeps the chat and its messages when the ticket is deleted, about no ticket from then on', async () => {
    const chatId = (await startChat('Why?', 'MOB-1')).body.chat.id;
    await answer();
    expect((await person('DELETE', '/api/tickets/MOB-1')).status).toBe(204);

    const detail = await chat(chatId);
    expect(detail.chat.ticket).toBeNull();
    expect(detail.messages.map((message) => message.text)).toEqual([
      'Why?',
      'Because of the cache.',
    ]);
    expect((await listed()).map((item) => [item.id, item.ticket])).toEqual([[chatId, null]]);
    await person('POST', `/api/chats/${chatId}/messages`, { runnerId: runner, text: 'Still?' });
    expect(await nextPrompt()).not.toContain('This chat is about');
  });
});
