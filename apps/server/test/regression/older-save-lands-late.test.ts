import type { ErrorBody, Ticket, TicketDetail } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { updateTicketMatching } from '../../src/repositories/tickets';
import { DIALECTS, useTestServer } from '../helpers/server';

// Reviewer 61 (PT-76): tab A's save of a title hung; tab B typed on top of A's text and saved.
// When A's older save landed, the tracker took it and B's newer text was gone. A save now says
// which values it was typed over, and the tracker refuses it once a field it changes has another.
describe.each(DIALECTS)('an older save landing late (%s)', (dialect) => {
  const api = useTestServer(dialect);
  let ticket: Ticket;

  beforeEach(async () => {
    await api.post('/api/projects', { name: 'Mobile app' });
    ticket = (await api.post<Ticket>('/api/projects/MA/tickets', { title: 'Fix login' })).body;
  });

  const path = () => `/api/tickets/${ticket.key}`;
  const current = async () => (await api.get<TicketDetail>(path())).body;

  it('is refused once the field has newer text, and changes nothing', async () => {
    const newer = await api.patch<Ticket>(path(), {
      title: 'Fix login now, please',
      expected: { title: 'Fix login' },
    });
    expect(newer.status).toBe(200);
    api.events.length = 0;

    const older = await api.patch<ErrorBody>(path(), {
      title: 'Fix login now',
      expected: { title: 'Fix login' },
    });
    expect(older.status).toBe(409);
    expect(older.body.error.code).toBe('stale');
    const detail = await current();
    expect(detail.ticket.title).toBe('Fix login now, please');
    expect(detail.ticket.updatedAt).toBe(newer.body.updatedAt);
    expect(detail.activity.map((item) => item.text)).toEqual(['created the ticket']);
    expect(api.events).toEqual([]);
  });

  it('checks only the fields it changes, and names as the tracker keeps them', async () => {
    await api.patch(path(), { assignee: '  Dara ' });
    const res = await api.patch<Ticket>(path(), {
      description: 'Steps',
      assignee: ' Sophea',
      expected: { title: 'Something else', description: '', assignee: 'Dara  ' },
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ description: 'Steps', assignee: 'Sophea' });
  });

  // Tab B cleared the assignee tab A was still sending. B's save changed nothing yet, and A's
  // older save, landing after it, would have put the name back over B's choice.
  it('is refused even when it changes nothing, once the field has other text', async () => {
    const res = await api.patch<ErrorBody>(path(), {
      assignee: '',
      expected: { assignee: 'Dara' },
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('stale');
    const same = await api.patch<Ticket>(path(), {
      title: 'Fix login',
      expected: { title: 'Fix login' },
    });
    expect(same.status).toBe(200);
  });

  it('still saves an update that names no values, such as an agent’s', async () => {
    await api.patch(path(), { title: 'Fix login now' });
    const res = await api.patch<Ticket>(path(), { title: 'Fix the login page' });
    expect(res.status).toBe(200);
    expect((await current()).ticket.title).toBe('Fix the login page');
  });

  // On Postgres with several connections, a save can commit after this one read the ticket; the
  // write itself matches the values, so it refuses there too.
  it('writes only while the row still has the values it was typed over', async () => {
    await api.patch(path(), { title: 'Fix login now' });
    expect(
      await updateTicketMatching(api.db, ticket.id, { title: 'Fix login' }, { title: 'X' }),
    ).toBe(false);
    expect((await current()).ticket.title).toBe('Fix login now');
    const match = { title: 'Fix login now' };
    expect(await updateTicketMatching(api.db, ticket.id, match, { title: 'Fix it' })).toBe(true);
    expect((await current()).ticket.title).toBe('Fix it');
  });
});
