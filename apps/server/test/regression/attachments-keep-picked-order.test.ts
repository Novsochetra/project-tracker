import type { Attachment, Ticket } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { fileUpload } from '../helpers/fixtures';
import { DIALECTS, useTestServer } from '../helpers/server';

// Files upload side by side, so a small one picked last often arrives first. A ticket's or
// comment's files were listed by upload time, so they showed in the order they arrived.
describe.each(DIALECTS)('files keep the order they were picked (%s)', (dialect) => {
  const api = useTestServer(dialect);
  let ticket: Ticket;

  beforeEach(async () => {
    await api.client().createProject({ name: 'Mobile app' });
    ticket = await api.client().createTicket('MA', { title: 'Crash' });
  });

  const uploadNamed = async (name: string, ticketKey?: string): Promise<Attachment> =>
    (await api.upload(fileUpload({ name, ...(ticketKey ? { ticketKey } : {}) }))).body;

  // Arrival order: c, a, b. Picked order: a, b, c.
  const arrivedOutOfOrder = async () => {
    const c = await uploadNamed('c.txt');
    const a = await uploadNamed('a.txt');
    const b = await uploadNamed('b.txt');
    return [a.id, b.id, c.id];
  };

  const names = (files: readonly Attachment[]) => files.map((file) => file.fileName);

  it('lists a new ticket’s files in the order of its attachmentIds', async () => {
    const created = await api.client().createTicket('MA', {
      title: 'Crash on rotate',
      attachmentIds: await arrivedOutOfOrder(),
    });
    const detail = await api.client().getTicket(created.key);
    expect(names(detail.attachments)).toEqual(['a.txt', 'b.txt', 'c.txt']);
  });

  it('lists a comment’s files in the order of its attachmentIds', async () => {
    const attachmentIds = await arrivedOutOfOrder();
    const comment = await api.client().addComment(ticket.key, { text: 'Logs', attachmentIds });
    expect(names(comment.attachments)).toEqual(['a.txt', 'b.txt', 'c.txt']);
    const detail = await api.client().getTicket(ticket.key);
    const listed = detail.activity.find((item) => item.id === comment.id);
    expect(names(listed?.attachments ?? [])).toEqual(['a.txt', 'b.txt', 'c.txt']);
  });

  it('puts a file added to a ticket later after the ones it was created with', async () => {
    const created = await api.client().createTicket('MA', {
      title: 'Crash on rotate',
      attachmentIds: await arrivedOutOfOrder(),
    });
    await uploadNamed('d.txt', created.key);
    await uploadNamed('e.txt', created.key);
    const detail = await api.client().getTicket(created.key);
    expect(names(detail.attachments)).toEqual(['a.txt', 'b.txt', 'c.txt', 'd.txt', 'e.txt']);
  });
});
