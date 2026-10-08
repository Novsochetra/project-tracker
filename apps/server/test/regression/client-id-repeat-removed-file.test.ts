import type { Attachment, ErrorBody, Ticket } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { imageUpload } from '../helpers/fixtures';
import { DIALECTS, useTestServer } from '../helpers/server';

// PT-82: a repeated create still names every file the capture holds, also one the first create
// attached and someone then removed from the ticket. That file is gone, so the repeat answered 400
// "Some files could not be attached. Upload them again." and attached none of the new ones, though
// the ticket exists and nothing can be uploaded again.

const CLIENT_ID = 'c-photo-capture';

describe.each(DIALECTS)(
  'a repeated create naming a file removed from the ticket (%s)',
  (dialect) => {
    const api = useTestServer(dialect);

    beforeEach(async () => {
      await api.client().createProject({ name: 'Mobile app', key: 'MOB' });
    });

    const upload = async (name: string): Promise<string> =>
      (await api.upload<Attachment>(imageUpload({ name }))).body.id;

    const create = (attachmentIds: string[]) =>
      api.post<Ticket | ErrorBody>('/api/projects/MOB/tickets', {
        title: 'Photo of the bug',
        clientId: CLIENT_ID,
        attachmentIds,
      });

    const files = async () =>
      (await api.client().getTicket('MOB-1')).attachments.map((file) => file.fileName);

    it('leaves it out and attaches the files chosen after the first create', async () => {
      const a1 = await upload('a1.png');
      const a2 = await upload('a2.png');
      await create([a1, a2]);
      await api.client().deleteAttachment(a1);
      const a3 = await upload('a3.png');

      const again = await create([a1, a2, a3]);

      expect(again.status).toBe(201);
      expect((again.body as Ticket).key).toBe('MOB-1');
      expect(await files()).toEqual(['a2.png', 'a3.png']);
    });

    it('answers with the ticket, changing nothing, when no other file is new', async () => {
      const a1 = await upload('a1.png');
      const a2 = await upload('a2.png');
      const first = await create([a1, a2]);
      await api.client().deleteAttachment(a2);
      const before = await api.client().getTicket('MOB-1');
      api.events.length = 0;

      const again = await create([a1, a2]);

      expect(again.status).toBe(201);
      expect((again.body as Ticket).updatedAt).toBe(before.ticket.updatedAt);
      expect((again.body as Ticket).id).toBe((first.body as Ticket).id);
      expect(api.events).toHaveLength(0);
      expect(await files()).toEqual(['a1.png']);
    });

    it('still refuses a first create naming a file that is gone', async () => {
      const a1 = await upload('a1.png');
      await api.client().deleteAttachment(a1);

      const res = await create([a1]);

      expect(res.status).toBe(400);
      expect((res.body as ErrorBody).error.message).toBe(
        'Some files could not be attached. Upload them again.',
      );
    });
  },
);
