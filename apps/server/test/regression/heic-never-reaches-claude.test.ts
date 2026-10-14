import { randomUUID } from 'node:crypto';
import type { Attachment, ChatDetail, RunJob } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { DECODES_HEIC } from '../../src/images/compressImage';
import { testClock } from '../helpers/auth';
import { jpegPhoto, TINY_HEIC } from '../helpers/images';
import { addUser, caller, helperName, type Auth, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

// PT-233 review: a HEIC dropped in on a Mac is kept as it came, with where it was taken, and the
// helper put it in Claude's folder. Claude can't view HEIC anyway.
describe.skipIf(DECODES_HEIC).each(DIALECTS)('a HEIC sent with a question (%s)', (dialect) => {
  const clock = testClock();
  const api = useTestServer(dialect, { now: clock.now });
  const runner = randomUUID();
  let person: Caller;
  let personAuth: Auth;
  let helper: Caller;

  const upload = async (bytes: Uint8Array, name: string, type: string) => {
    const response = await api.app.request('/api/attachments', {
      method: 'POST',
      headers: { cookie: personAuth.cookie ?? '', 'content-type': type, 'x-file-name': name },
      body: bytes,
    });
    expect(response.status).toBe(201);
    return (await response.json()) as Attachment;
  };

  beforeEach(async () => {
    clock.set(1_000_000);
    const owner = await addUser(api.db, 'owner@example.com', clock.now());
    personAuth = owner.person;
    person = caller(() => api.app, owner.person);
    helper = caller(() => api.app, owner.helper);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await helper('PUT', `/api/runners/${runner}`, helperName('Dara’s MacBook'));
  });

  it('never goes to the helper, and Claude is told why', async () => {
    const heic = await upload(TINY_HEIC, 'IMG_1.heic', 'image/heic');
    expect(heic.mimeType).toBe('image/heic');
    const photo = await upload(await jpegPhoto({ width: 8, height: 8 }), 'board.jpg', 'image/jpeg');
    const started = await person<ChatDetail>('POST', '/api/projects/MOB/chats', {
      runnerId: runner,
      text: 'What is wrong here?',
      attachmentIds: [heic.id, photo.id],
    });
    expect(started.body.messages[0]?.attachments).toHaveLength(2);
    const job = (await helper<RunJob>('POST', `/api/runners/${runner}/next?kind=ask`)).body;
    expect(job.files?.map((file) => file.id)).toEqual([photo.id]);
    expect(job.prompt).toContain(
      'IMG_1.heic was not passed to you: the tracker cannot remove its location.',
    );
  });
});
