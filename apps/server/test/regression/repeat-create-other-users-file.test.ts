import { FILE_NAME_HEADER, type Attachment, type CreatedTicket } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { addUser, caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

// A repeated create counted another user's file as there, so its 400 told B the id existed, where a
// made-up id was left out (PT-142 review).
describe.each(DIALECTS)("a repeated create naming another user's file (%s)", (dialect) => {
  const api = useTestServer(dialect);

  it('leaves it out like a file that is gone', async () => {
    const a = await addUser(api.db, 'a@example.com', Date.now(), 'owner');
    const b = await addUser(api.db, 'b@example.com', Date.now() + 1);
    const upload = await api.app.request('/api/attachments', {
      method: 'POST',
      headers: {
        cookie: a.person.cookie!,
        'content-type': 'text/plain',
        [FILE_NAME_HEADER]: 'a.txt',
      },
      body: 'notes of A',
    });
    const aFile = ((await upload.json()) as Attachment).id;
    const asB = caller(() => api.app, b.person);
    await asB('POST', '/api/projects', { name: 'Web', key: 'WEB' });
    const create = { title: 'Mine', clientId: 'c-1' };
    expect((await asB('POST', '/api/projects/WEB/tickets', create)).status).toBe(201);

    const repeat = await asB<CreatedTicket>('POST', '/api/projects/WEB/tickets', {
      ...create,
      attachmentIds: [aFile],
    });
    expect(repeat.status).toBe(201);
    expect(repeat.body.leftOutAttachmentIds).toEqual([aFile]);
  });
});
