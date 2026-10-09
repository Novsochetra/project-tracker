import type { Attachment, CreatedTicket } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { PENDING_TTL_MS, removeStalePendingAttachments } from '../../src/services/attachments';
import { imageUpload } from '../helpers/fixtures';
import { DIALECTS, useTestServer } from '../helpers/server';

// PT-97: since PT-82 a repeated create leaves out a file that is gone instead of refusing the
// rest. That also covers a file chosen after the first create whose upload expired (24 h) before
// the repeat, and the answer said nothing of it: quick capture said "MOB-1 created" and the
// person never learned the file wasn't on the ticket. The answer now names what was left out.

const CLIENT_ID = 'c-photo-capture';

describe.each(DIALECTS)('a repeated create naming a file that is gone (%s)', (dialect) => {
  const api = useTestServer(dialect);

  beforeEach(async () => {
    await api.client().createProject({ name: 'Mobile app', key: 'MOB' });
  });

  const upload = async (name: string): Promise<string> =>
    (await api.upload<Attachment>(imageUpload({ name }))).body.id;

  const create = (attachmentIds: string[]) =>
    api.post<CreatedTicket>('/api/projects/MOB/tickets', {
      title: 'Photo of the bug',
      clientId: CLIENT_ID,
      attachmentIds,
    });

  const expirePendingUploads = () =>
    removeStalePendingAttachments(
      { db: api.db, storage: api.storage },
      Date.now() + PENDING_TTL_MS + 1,
    );

  const files = async () =>
    (await api.client().getTicket('MOB-1')).attachments.map((file) => file.fileName);

  it('names a later file whose upload expired before the repeat', async () => {
    const a1 = await upload('a1.png');
    await create([a1]);
    const a2 = await upload('a2.png');
    const a3 = await upload('a3.png');
    expect(await expirePendingUploads()).toBe(2);
    const a4 = await upload('a4.png');

    const again = await create([a1, a2, a3, a4]);

    expect(again.status).toBe(201);
    expect(again.body.key).toBe('MOB-1');
    expect(again.body.leftOutAttachmentIds).toEqual([a2, a3]);
    expect(await files()).toEqual(['a1.png', 'a4.png']);
  });

  it('names a file removed from the ticket since the first create', async () => {
    const a1 = await upload('a1.png');
    const a2 = await upload('a2.png');
    await create([a1, a2]);
    await api.client().deleteAttachment(a1);

    const again = await create([a1, a2]);

    expect(again.body.leftOutAttachmentIds).toEqual([a1]);
  });

  it('names nothing when every file is on the ticket', async () => {
    const a1 = await upload('a1.png');
    const first = await create([a1]);
    const a2 = await upload('a2.png');

    const again = await create([a1, a2]);

    expect(first.body).not.toHaveProperty('leftOutAttachmentIds');
    expect(again.body).not.toHaveProperty('leftOutAttachmentIds');
    expect(await files()).toEqual(['a1.png', 'a2.png']);
  });
});
