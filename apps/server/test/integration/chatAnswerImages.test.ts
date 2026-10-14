import { randomUUID } from 'node:crypto';
import type { Attachment, ChatDetail, RunJob } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { testClock } from '../helpers/auth';
import { pngImage, twoColorPixels } from '../helpers/images';
import { addUser, caller, helperName, type Auth, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

const NOTES = new TextEncoder().encode('Not a picture.\n');
const ANSWER = 'Here is the screen:\n\n````image\npath: docs/home.png\n````';

describe.each(DIALECTS)("pictures in Claude's answer (%s)", (dialect) => {
  const clock = testClock();
  const api = useTestServer(dialect, { now: clock.now });
  const runner = randomUUID();
  let person: Caller;
  let helper: Caller;
  let helperAuth: Auth;
  let otherHelper: Auth;
  let board: Uint8Array;

  const upload = async (bytes: Uint8Array, name: string, type: string, auth = helperAuth) => {
    const headers = {
      authorization: `Bearer ${auth.token ?? ''}`,
      'content-type': type,
      'x-file-name': name,
    };
    const response = await api.app.request('/api/attachments', {
      method: 'POST',
      headers,
      body: bytes,
    });
    expect(response.status).toBe(201);
    return (await response.json()) as Attachment;
  };
  const askAndTake = async () => {
    const started = await person<ChatDetail>('POST', '/api/projects/MOB/chats', {
      runnerId: runner,
      text: 'Show me the home screen',
    });
    const job = (await helper<RunJob>('POST', `/api/runners/${runner}/next?kind=ask`)).body;
    return { chatId: started.body.chat.id, runId: job.run.id };
  };
  const finish = (runId: string, attachmentIds: string[]) => {
    clock.advance(1_000);
    return helper('POST', `/api/runs/${runId}/finish`, {
      status: 'done',
      answer: ANSWER,
      attachmentIds,
    });
  };
  const claudeMessage = async (chatId: string) =>
    (await person<ChatDetail>('GET', `/api/chats/${chatId}`)).body.messages.at(-1);

  beforeEach(async () => {
    clock.set(1_000_000);
    board = await pngImage(twoColorPixels(8, 8), 8, 8);
    const owner = await addUser(api.db, 'owner@example.com', clock.now());
    person = caller(() => api.app, owner.person);
    helper = caller(() => api.app, owner.helper);
    helperAuth = owner.helper;
    otherHelper = (await addUser(api.db, 'other@example.com', clock.now())).helper;
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await helper('PUT', `/api/runners/${runner}`, helperName('Dara’s MacBook'));
  });

  it("shows the helper's uploads on Claude's message in the answer's order, and keeps its words", async () => {
    const { chatId, runId } = await askAndTake();
    const first = await upload(board, 'home.png', 'image/png');
    const second = await upload(board, 'settings.png', 'image/png');
    expect((await finish(runId, [second.id, first.id])).status).toBe(200);
    const message = await claudeMessage(chatId);
    expect(message?.role).toBe('claude');
    expect(message?.text).toBe(ANSWER);
    expect(message?.attachments.map((file) => file.id)).toEqual([second.id, first.id]);
  });

  it("leaves out another user's upload, a file that isn't a picture and one already shown", async () => {
    const { chatId, runId } = await askAndTake();
    const theirs = await upload(board, 'theirs.png', 'image/png', otherHelper);
    const notes = await upload(NOTES, 'notes.txt', 'text/plain');
    const photo = await upload(board, 'home.png', 'image/png');
    const ids = [theirs.id, notes.id, photo.id, photo.id];
    expect((await finish(runId, ids)).status).toBe(200);
    expect((await claudeMessage(chatId))?.attachments.map((file) => file.id)).toEqual([photo.id]);

    const next = await askAndTake();
    expect((await finish(next.runId, [photo.id])).status).toBe(200);
    expect((await claudeMessage(next.chatId))?.attachments).toEqual([]);
  });

  it('refuses more pictures than an answer shows', async () => {
    const { runId } = await askAndTake();
    const ids = Array.from({ length: 11 }, () => randomUUID());
    expect((await finish(runId, ids)).status).toBe(400);
  });
});
