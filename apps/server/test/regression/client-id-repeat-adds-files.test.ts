import type { Attachment, ErrorBody, Ticket } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { imageUpload } from '../helpers/fixtures';
import { DIALECTS, useTestServer } from '../helpers/server';

// PT-78: a create that repeated a client id was answered with the first ticket before its files
// were looked at. Quick capture with photo A whose answer was lost, then photo B and Create again:
// "MOB-1 created", MOB-1 had only A, and B waited unattached until it expired.

const CLIENT_ID = 'c-photo-capture';

describe.each(DIALECTS)('a repeated create with files chosen after the first (%s)', (dialect) => {
  const api = useTestServer(dialect);

  beforeEach(async () => {
    await api.client().createProject({ name: 'Mobile app', key: 'MOB' });
    await api.client().createProject({ name: 'Website', key: 'WEB' });
  });

  const upload = async (name: string, ticketKey?: string): Promise<string> =>
    (await api.upload<Attachment>(imageUpload({ name, ...(ticketKey ? { ticketKey } : {}) }))).body
      .id;

  const create = (attachmentIds: string[], projectKey = 'MOB') =>
    api.post<Ticket>(`/api/projects/${projectKey}/tickets`, {
      title: 'Photo of the bug',
      clientId: CLIENT_ID,
      attachmentIds,
    });

  const files = async (ticketKey = 'MOB-1') =>
    (await api.client().getTicket(ticketKey)).attachments.map((file) => file.fileName);

  it('attaches them to the ticket the first create made', async () => {
    const a1 = await upload('a1.png');
    await create([a1]);
    const a2 = await upload('a2.png');

    const again = await create([a1, a2]);

    expect(again.status).toBe(201);
    expect(again.body.key).toBe('MOB-1');
    expect(await files()).toEqual(['a1.png', 'a2.png']);
    expect((await api.client().listTickets('MOB')).map((ticket) => ticket.key)).toEqual(['MOB-1']);
  });

  it('puts them after files the ticket got meanwhile, in the order they were picked', async () => {
    const a1 = await upload('a1.png');
    await create([a1]);
    await upload('theirs.png', 'MOB-1');
    const a3 = await upload('a3.png');
    const a2 = await upload('a2.png');

    await create([a1, a2, a3]);

    expect(await files()).toEqual(['a1.png', 'theirs.png', 'a2.png', 'a3.png']);
  });

  it('tells open screens, and changes nothing else', async () => {
    const a1 = await upload('a1.png');
    const first = await create([a1]);
    const a2 = await upload('a2.png');
    api.events.length = 0;

    const again = await create([a1, a2]);

    expect(api.events).toHaveLength(1);
    expect({ ...again.body, updatedAt: first.body.updatedAt }).toEqual(first.body);
    const detail = await api.client().getTicket('MOB-1');
    expect(detail.activity.map((item) => item.text)).toEqual(['created the ticket']);
  });

  it('refuses a file that is on another ticket and attaches none of them', async () => {
    const a1 = await upload('a1.png');
    await create([a1]);
    await api.client().createTicket('WEB', { title: 'Other' });
    const theirs = await upload('theirs.png', 'WEB-1');
    const a2 = await upload('a2.png');

    const again = await api.post<ErrorBody>('/api/projects/MOB/tickets', {
      title: 'Photo of the bug',
      clientId: CLIENT_ID,
      attachmentIds: [a1, a2, theirs],
    });

    expect(again.status).toBe(400);
    expect(again.body.error.code).toBe('invalid_input');
    expect(await files()).toEqual(['a1.png']);
    expect(await files('WEB-1')).toEqual(['theirs.png']);
    expect((await create([a1, a2])).status).toBe(201);
    expect(await files()).toEqual(['a1.png', 'a2.png']);
  });
});
