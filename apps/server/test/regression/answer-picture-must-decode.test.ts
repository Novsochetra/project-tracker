import { randomUUID } from 'node:crypto';
import type { Attachment, ChatDetail, RunJob } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { testClock } from '../helpers/auth';
import { pngImage, twoColorPixels } from '../helpers/images';
import { addUser, caller, helperName, type Auth, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

// PT-225 review: bytes that are no image, sent as image/png, are stored as they came under that
// type, and an answer showed them as its picture: a prompt-injected answer could send any file.
const encode = (text: string) => new TextEncoder().encode(text);
const NOT_PICTURES = {
  'secrets.png': encode('API_KEY=abc\n'),
  'drawing.png': encode('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"/>'),
};

describe.each(DIALECTS)('a picture in an answer (%s)', (dialect) => {
  const clock = testClock();
  const api = useTestServer(dialect, { now: clock.now });
  const runner = randomUUID();
  let person: Caller;
  let helper: Caller;
  let helperAuth: Auth;

  const upload = async (bytes: Uint8Array, name: string) => {
    const response = await api.app.request('/api/attachments', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${helperAuth.token ?? ''}`,
        'content-type': 'image/png',
        'x-file-name': name,
      },
      body: bytes,
    });
    expect(response.status).toBe(201);
    return ((await response.json()) as Attachment).id;
  };

  beforeEach(async () => {
    clock.set(1_000_000);
    const owner = await addUser(api.db, 'owner@example.com', clock.now());
    person = caller(() => api.app, owner.person);
    helper = caller(() => api.app, owner.helper);
    helperAuth = owner.helper;
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await helper('PUT', `/api/runners/${runner}`, helperName('Dara’s MacBook'));
  });

  it('shows only bytes the tracker read as an image, whatever their name and type', async () => {
    const started = await person<ChatDetail>('POST', '/api/projects/MOB/chats', {
      runnerId: runner,
      text: 'Show me the home screen',
    });
    const job = (await helper<RunJob>('POST', `/api/runners/${runner}/next?kind=ask`)).body;
    const fakes = await Promise.all(
      Object.entries(NOT_PICTURES).map(([name, bytes]) => upload(bytes, name)),
    );
    const real = await upload(await pngImage(twoColorPixels(8, 8), 8, 8), 'home.png');
    clock.advance(1_000);
    const finished = await helper('POST', `/api/runs/${job.run.id}/finish`, {
      status: 'done',
      answer: 'Here.',
      attachmentIds: [...fakes, real],
    });
    expect(finished.status).toBe(200);
    const chat = await person<ChatDetail>('GET', `/api/chats/${started.body.chat.id}`);
    expect(chat.body.messages.at(-1)?.attachments.map((file) => file.id)).toEqual([real]);
  });
});
