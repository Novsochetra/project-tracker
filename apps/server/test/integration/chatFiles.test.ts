import { randomUUID } from 'node:crypto';
import type { Attachment, ChatDetail, RunJob } from '@tracker/shared';
import sharp from 'sharp';
import { beforeEach, describe, expect, it } from 'vitest';
import { testClock } from '../helpers/auth';
import { containsText, jpegPhoto, pngImage, twoColorPixels } from '../helpers/images';
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

  it('gives the helper a photo without where it was taken or with what', async () => {
    const photo = await jpegPhoto({ width: 64, height: 48, camera: true });
    expect(containsText(photo, 'iPhone 15 Pro')).toBe(true);
    const sent = await upload(photo, 'IMG_0001.jpg', 'image/jpeg');
    expect((await startChat('What is wrong here?', [sent.id])).status).toBe(201);
    const job = (await next()).body;
    const headers = { authorization: `Bearer ${helperAuth.token ?? ''}` };
    const file = await api.app.request(`/api/attachments/${job?.files?.[0]?.id ?? ''}/file`, {
      headers,
    });
    const bytes = new Uint8Array(await file.arrayBuffer());
    expect(containsText(bytes, 'iPhone 15 Pro')).toBe(false);
    const meta = await sharp(bytes).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.width).toBe(64);
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

  it("refuses another user's upload, and keeps nothing of the question", async () => {
    const other = await addUser(api.db, 'other@example.com', clock.now());
    const theirs = await upload(NOTES, 'theirs.txt', 'text/plain', other.person);
    const refused = await startChat('Look', [theirs.id]);
    expect(refused).toMatchObject({
      status: 400,
      body: { error: { message: 'Some files could not be sent. Upload them again.' } },
    });
    expect((await person('GET', '/api/projects/MOB/chats')).body).toEqual([]);
  });

  it('takes questions only from a person', async () => {
    const { notes } = await uploadBoth();
    expect((await startChat('Look', [notes.id], helper)).status).toBe(403);
  });

  it('removes the files with their chat', async () => {
    const chatId = (await startChat('Look', [(await uploadBoth()).photo.id])).body.chat.id;
    await finish((await next()).body?.run.id ?? '');
    expect(api.storage.files.size).toBe(2);

    expect((await person('DELETE', `/api/chats/${chatId}`)).status).toBe(204);
    expect(api.storage.files.size).toBe(1);
    expect(await rowCount()).toBe(1);
  });
});
