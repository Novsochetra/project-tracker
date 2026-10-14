import { randomUUID } from 'node:crypto';
import {
  CHAT_QUEUE_FULL,
  CHAT_QUEUE_MAX,
  type Attachment,
  type ChatDetail,
  type Run,
  type RunJob,
} from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { testClock } from '../helpers/auth';
import { addUser, caller, helperName, type Auth, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

const SESSION = '11111111-2222-4333-8444-555555555555';
const NOTES = new TextEncoder().encode('Sync takes 40 s on 3G.\n');

describe.each(DIALECTS)('messages queued while Claude answers (%s)', (dialect) => {
  const clock = testClock();
  const api = useTestServer(dialect, { now: clock.now });
  const runner = randomUUID();
  let person: Caller;
  let personAuth: Auth;
  let helper: Caller;

  const ask = (chatId: string, text: string, body: object = {}) =>
    person<ChatDetail>('POST', `/api/chats/${chatId}/messages`, {
      runnerId: runner,
      text,
      ...body,
    });
  const next = (lane: 'ask' | 'ticket' = 'ask') =>
    helper<RunJob | null>('POST', `/api/runners/${runner}/next?kind=${lane}`);
  const finish = (id: string, body: object) => helper<Run>('POST', `/api/runs/${id}/finish`, body);
  const answer = (job: RunJob | null, text: string) =>
    finish(job?.run.id ?? '', { status: 'done', answer: text, sessionId: SESSION });
  const chat = async (id: string) => (await person<ChatDetail>('GET', `/api/chats/${id}`)).body;
  const queuedOf = async (id: string) => (await chat(id)).queued?.map(({ text }) => text);
  const queue = (chatId: string, messageId: string, path = '') =>
    `/api/chats/${chatId}/queue/${messageId}${path}`;

  // A chat whose first question the helper is answering.
  async function working(): Promise<string> {
    const started = await person<ChatDetail>('POST', '/api/projects/MOB/chats', {
      runnerId: runner,
      text: 'How does sync work?',
    });
    await next();
    clock.advance(1_000);
    return started.body.chat.id;
  }

  const upload = async (bytes: Uint8Array, name: string) => {
    const headers = { cookie: personAuth.cookie ?? '', 'content-type': 'text/plain' };
    const response = await api.app.request('/api/attachments', {
      method: 'POST',
      headers: { ...headers, 'x-file-name': name },
      body: bytes,
    });
    return (await response.json()) as Attachment;
  };

  beforeEach(async () => {
    clock.set(1_000_000);
    const owner = await addUser(api.db, 'owner@example.com', clock.now());
    personAuth = owner.person;
    person = caller(() => api.app, owner.person);
    helper = caller(() => api.app, owner.helper);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await helper('PUT', `/api/runners/${runner}`, helperName('Mac'));
  });

  it('saves a message sent while Claude answers, and runs each as its own turn in order', async () => {
    const chatId = await working();
    const first = (await chat(chatId)).run;
    const queued = await ask(chatId, 'And the tests?');
    expect(queued.status).toBe(200);
    expect(queued.body.messages.map(({ text }) => text)).toEqual(['How does sync work?']);
    expect(queued.body.queued).toMatchObject([
      { text: 'And the tests?', options: { model: 'default', mode: 'ask', effort: 'default' } },
    ]);
    expect(queued.body.run?.id).toBe(first?.id);
    clock.advance(1_000);
    await ask(chatId, 'And the docs?', { mode: 'plan' });

    clock.advance(1_000);
    await answer({ run: first } as RunJob, 'Every minute.');
    const second = (await next()).body;
    expect(second?.resumeSessionId).toBe(SESSION);
    expect(second?.prompt).toContain('And the tests?');
    expect(second?.prompt).not.toContain('And the docs?');
    const during = await chat(chatId);
    expect(during.messages.map(({ text }) => text)).toEqual([
      'How does sync work?',
      'Every minute.',
      'And the tests?',
    ]);
    expect(during.queued?.map(({ text }) => text)).toEqual(['And the docs?']);

    clock.advance(1_000);
    await answer(second, 'They pass.');
    const third = (await next()).body;
    expect(third?.run.askOptions).toMatchObject({ mode: 'plan' });
    expect(third?.prompt).toContain('And the docs?');
    clock.advance(1_000);
    await answer(third, 'In docs/.');
    const after = await chat(chatId);
    expect(after.messages.map(({ role }) => role)).toEqual([
      'person',
      'claude',
      'person',
      'claude',
      'person',
      'claude',
    ]);
    expect(after.queued).toEqual([]);
    expect((await next()).status).toBe(204);
  });

  it.each([
    ['stopped', (job: RunJob | null) => person('POST', `/api/runs/${job?.run.id ?? ''}/cancel`)],
    ['failed', (job: RunJob | null) => finish(job?.run.id ?? '', { status: 'failed', error: 'x' })],
  ])('starts nothing after a turn that %s, until Send now', async (_name, end) => {
    const started = await person<ChatDetail>('POST', '/api/projects/MOB/chats', {
      runnerId: runner,
      text: 'How does sync work?',
    });
    const job = (await next()).body;
    const chatId = started.body.chat.id;
    await ask(chatId, 'And the tests?');
    await end(job);
    expect((await next()).status).toBe(204);
    const held = await chat(chatId);
    expect(held.queued?.map(({ text }) => text)).toEqual(['And the tests?']);

    const id = held.queued?.[0]?.id ?? '';
    const sent = await person<ChatDetail>('POST', queue(chatId, id, '/send'));
    expect(sent.status).toBe(200);
    expect(sent.body.queued).toEqual([]);
    expect(sent.body.messages.at(-1)?.text).toBe('And the tests?');
    expect((await next()).body?.prompt).toContain('And the tests?');
  });

  it('refuses Send now while Claude still answers', async () => {
    const chatId = await working();
    const id = (await ask(chatId, 'And the tests?')).body.queued?.[0]?.id ?? '';
    const refused = await person('POST', queue(chatId, id, '/send'));
    expect(refused.status).toBe(409);
    expect(await queuedOf(chatId)).toEqual(['And the tests?']);
  });

  it('lets the person edit and remove a queued message before it runs', async () => {
    const chatId = await working();
    await ask(chatId, 'And the tests?');
    const ids = (await ask(chatId, 'And the docs?')).body.queued?.map(({ id }) => id) ?? [];
    const edited = await person<ChatDetail>('PATCH', queue(chatId, ids[0] ?? ''), {
      text: '  And the e2e tests?  ',
    });
    expect(edited.body.queued?.map(({ text }) => text)).toEqual([
      'And the e2e tests?',
      'And the docs?',
    ]);
    expect((await person('PATCH', queue(chatId, ids[1] ?? ''), { text: ' ' })).status).toBe(400);
    const removed = await person<ChatDetail>('DELETE', queue(chatId, ids[1] ?? ''));
    expect(removed.body.queued?.map(({ text }) => text)).toEqual(['And the e2e tests?']);
    expect((await person('DELETE', queue(chatId, ids[1] ?? ''))).status).toBe(409);

    const first = (await chat(chatId)).run;
    await answer({ run: first } as RunJob, 'Every minute.');
    expect((await next()).body?.prompt).toContain('And the e2e tests?');
    const gone = await person('PATCH', queue(chatId, ids[0] ?? ''), { text: 'Late' });
    expect(gone.status).toBe(409);
  });

  it(`refuses more than ${CHAT_QUEUE_MAX} queued messages with a clear message`, async () => {
    const chatId = await working();
    for (let index = 0; index < CHAT_QUEUE_MAX; index += 1) {
      expect((await ask(chatId, `Question ${index}?`)).status).toBe(200);
    }
    const refused = await ask(chatId, 'One more?');
    expect(refused.status).toBe(409);
    expect(refused.body).toMatchObject({ error: { message: CHAT_QUEUE_FULL } });
    expect(await queuedOf(chatId)).toHaveLength(CHAT_QUEUE_MAX);
  });

  it('keeps the files of a queued message, gives them to its run, and removes them with it', async () => {
    const chatId = await working();
    const notes = await upload(NOTES, 'notes.txt');
    const queued = await ask(chatId, 'Read this', { attachmentIds: [notes.id] });
    expect(queued.body.queued?.[0]?.attachments.map((file) => file.fileName)).toEqual([
      'notes.txt',
    ]);
    const other = await upload(NOTES, 'other.txt');
    const second = await ask(chatId, 'And this', { attachmentIds: [other.id] });
    const files = api.storage.files.size;
    await person('DELETE', queue(chatId, second.body.queued?.[1]?.id ?? ''));
    expect(api.storage.files.size).toBe(files - 1);

    const first = (await chat(chatId)).run;
    await answer({ run: first } as RunJob, 'Every minute.');
    const job = (await next()).body;
    expect(job?.files?.map((file) => file.id)).toEqual([notes.id]);
    expect(job?.prompt).toContain('(Sent with it: notes.txt)');
  });

  it("hides another user's queue and refuses an agent token", async () => {
    const chatId = await working();
    const id = (await ask(chatId, 'And the tests?')).body.queued?.[0]?.id ?? '';
    const other = await addUser(api.db, 'other@example.com', clock.now());
    const stranger = caller(() => api.app, other.person);
    expect((await stranger('DELETE', queue(chatId, id))).status).toBe(404);
    expect((await stranger('PATCH', queue(chatId, id), { text: 'Mine' })).status).toBe(404);
    expect((await helper('DELETE', queue(chatId, id))).status).toBe(403);
    expect((await helper('POST', queue(chatId, id, '/send'))).status).toBe(403);
    expect(await queuedOf(chatId)).toEqual(['And the tests?']);
  });
});
