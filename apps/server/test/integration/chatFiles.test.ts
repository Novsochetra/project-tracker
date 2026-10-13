import { randomUUID } from 'node:crypto';
import type { Attachment, ChatDetail, RunJob } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { PENDING_TTL_MS, removeStalePendingAttachments } from '../../src/services/attachments';
import { testClock } from '../helpers/auth';
import { pngImage, twoColorPixels } from '../helpers/images';
import { addUser, caller, helperName, type Auth, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

const NOTES = new TextEncoder().encode('Sync takes 40 s on 3G.\n');

describe.each(DIALECTS)('files sent with a chat question (%s)', (dialect) => {
  const clock = testClock();
  const api = useTestServer(dialect, { now: clock.now });
  const runner = randomUUID();
  let person: Caller;
  let personAuth: Auth;
  let helper: Caller;
  let helperAuth: Auth;
  let board: Uint8Array;

  const upload = async (bytes: Uint8Array, name: string, type: string, auth = personAuth) => {
    const headers = { cookie: auth.cookie ?? '', 'content-type': type, 'x-file-name': name };
    const response = await api.app.request('/api/attachments', {
      method: 'POST',
      headers,
      body: bytes,
    });
    expect(response.status).toBe(201);
    return (await response.json()) as Attachment;
  };
  const uploadBoth = async () => ({
    notes: await upload(NOTES, 'notes.txt', 'text/plain'),
    photo: await upload(board, 'board.png', 'image/png'),
  });
  const startChat = (text: string, attachmentIds: string[], as: Caller = person) =>
    as<ChatDetail>('POST', '/api/projects/MOB/chats', { runnerId: runner, text, attachmentIds });
  const next = () => helper<RunJob | null>('POST', `/api/runners/${runner}/next?kind=ask`);
  const finish = (id: string) =>
    helper('POST', `/api/runs/${id}/finish`, { status: 'done', answer: 'Two tickets.' });
  const rowCount = async () =>
    (await api.db.selectFrom('attachments').select('id').execute()).length;

  beforeEach(async () => {
    clock.set(1_000_000);
    board = await pngImage(twoColorPixels(8, 8), 8, 8);
    const owner = await addUser(api.db, 'owner@example.com', clock.now());
    personAuth = owner.person;
    person = caller(() => api.app, owner.person);
    helper = caller(() => api.app, owner.helper);
    helperAuth = owner.helper;
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await helper('PUT', `/api/runners/${runner}`, helperName('Dara’s MacBook'));
  });

  it("shows the files on the person's message and gives them to the helper in picked order", async () => {
    const { notes, photo } = await uploadBoth();
    const started = await startChat('Turn this into tickets', [photo.id, notes.id]);
    expect(started.status).toBe(201);
    const [question] = started.body.messages;
    expect(question?.attachments.map((file) => file.fileName)).toEqual(['board.png', 'notes.txt']);

    const job = (await next()).body;
    expect(job?.files?.map((file) => file.id)).toEqual([photo.id, notes.id]);
    expect(job?.prompt).toContain('Turn this into tickets\n(Sent with it: board.png, notes.txt)');
    const headers = { authorization: `Bearer ${helperAuth.token ?? ''}` };
    const file = await api.app.request(`/api/attachments/${notes.id}/file`, { headers });
    expect(await file.text()).toBe('Sync takes 40 s on 3G.\n');
    clock.advance(1_000);
    await finish(job?.run.id ?? '');
    const detail = (await person<ChatDetail>('GET', `/api/chats/${started.body.chat.id}`)).body;
    expect(detail.messages.map((message) => message.attachments.length)).toEqual([2, 0]);
  });

  it('sends files with a later question, and names earlier ones to a helper without the session', async () => {
    const chatId = (await startChat('First', [(await uploadBoth()).photo.id])).body.chat.id;
    await finish((await next()).body?.run.id ?? '');
    const other = randomUUID();
    await helper('PUT', `/api/runners/${other}`, helperName('Mac mini'));
    const notes = await upload(NOTES, 'notes.txt', 'text/plain');
    const ask = { runnerId: other, text: 'And this?', attachmentIds: [notes.id] };
    expect((await person('POST', `/api/chats/${chatId}/messages`, ask)).status).toBe(200);

    const job = (await helper<RunJob>('POST', `/api/runners/${other}/next?kind=ask`)).body;
    expect(job.files?.map((file) => file.fileName)).toEqual(['notes.txt']);
    expect(job.prompt).toContain('Person:\nFirst\n(Sent with it: board.png)');
  });

  it("refuses another user's upload and a file already sent, and keeps nothing of the question", async () => {
    const other = await addUser(api.db, 'other@example.com', clock.now());
    const theirs = await upload(NOTES, 'theirs.txt', 'text/plain', other.person);
    const refused = await startChat('Look', [theirs.id]);
    expect(refused).toMatchObject({
      status: 400,
      body: { error: { message: 'Some files could not be sent. Upload them again.' } },
    });
    expect((await person('GET', '/api/projects/MOB/chats')).body).toEqual([]);

    const { photo } = await uploadBoth();
    const chatId = (await startChat('Look', [photo.id])).body.chat.id;
    await finish((await next()).body?.run.id ?? '');
    const again = { runnerId: runner, text: 'Again', attachmentIds: [photo.id] };
    expect((await person('POST', `/api/chats/${chatId}/messages`, again)).status).toBe(400);
    expect((await person<ChatDetail>('GET', `/api/chats/${chatId}`)).body.messages).toHaveLength(2);
  });

  it('takes questions only from a person', async () => {
    const { notes } = await uploadBoth();
    expect((await startChat('Look', [notes.id], helper)).status).toBe(403);
  });

  it('never treats a sent file as pending: it stays past a day and joins no ticket', async () => {
    const { photo } = await uploadBoth();
    await startChat('Look', [photo.id]);
    const later = clock.now() + PENDING_TTL_MS + 1;
    expect(await removeStalePendingAttachments(api, later)).toBe(1);
    expect(await rowCount()).toBe(1);
    const ticket = { title: 'Steal it', attachmentIds: [photo.id] };
    expect((await person('POST', '/api/projects/MOB/tickets', ticket)).status).toBe(400);
  });

  it('removes the files with their chat, and with their project', async () => {
    const chatId = (await startChat('Look', [(await uploadBoth()).photo.id])).body.chat.id;
    await finish((await next()).body?.run.id ?? '');
    const second = (await startChat('More', [(await uploadBoth()).notes.id])).body.chat.id;
    expect(api.storage.files.size).toBe(4);

    expect((await person('DELETE', `/api/chats/${chatId}`)).status).toBe(204);
    expect(api.storage.files.size).toBe(3);
    expect(await rowCount()).toBe(3);
    expect((await person('DELETE', '/api/projects/MOB')).status).toBe(204);
    expect((await person('GET', `/api/chats/${second}`)).status).toBe(404);
    // The two uploads never sent stay pending until they expire.
    expect(await rowCount()).toBe(2);
    expect(api.storage.files.size).toBe(2);
  });
});
