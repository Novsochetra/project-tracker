import type { Activity, ErrorBody, Ticket, TicketDetail } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { updateActivityMatching } from '../../src/repositories/activities';
import { DIALECTS, useTestServer } from '../helpers/server';

// Reviewer 77 (PT-90): comment edits said nothing about the text they were typed over, so tab A's
// edit save that hung and landed late overwrote tab B's newer edit. An edit now names that text,
// and the tracker refuses it once the comment has other text, as it does for ticket fields.
describe.each(DIALECTS)('an older comment edit landing late (%s)', (dialect) => {
  const api = useTestServer(dialect);
  let ticket: Ticket;
  let comment: Activity;

  beforeEach(async () => {
    await api.post('/api/projects', { name: 'Mobile app' });
    ticket = (await api.post<Ticket>('/api/projects/MA/tickets', { title: 'Fix login' })).body;
    comment = (await api.post<Activity>(`/api/tickets/${ticket.key}/comments`, { text: 'First' }))
      .body;
  });

  const path = () => `/api/activity/${comment.id}`;
  const current = async () =>
    (await api.get<TicketDetail>(`/api/tickets/${ticket.key}`)).body.activity.find(
      (item) => item.id === comment.id,
    );

  it('is refused once the comment has newer text, and changes nothing', async () => {
    const newer = await api.patch<Activity>(path(), {
      text: 'First, edited by B',
      expected: { text: 'First' },
    });
    expect(newer.status).toBe(200);
    api.events.length = 0;

    const older = await api.patch<ErrorBody>(path(), {
      text: 'First, edited by A',
      expected: { text: 'First' },
    });
    expect(older.status).toBe(409);
    expect(older.body.error.code).toBe('stale');
    expect(await current()).toMatchObject({
      text: 'First, edited by B',
      editedAt: newer.body.editedAt,
    });
    expect(api.events).toEqual([]);
  });

  it('is refused even when it changes nothing, once the comment has other text', async () => {
    await api.patch(path(), { text: 'Second' });
    const res = await api.patch<ErrorBody>(path(), {
      text: 'Second',
      expected: { text: 'First' },
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('stale');
  });

  it('compares the text as the tracker keeps it, trimmed', async () => {
    const res = await api.patch<Activity>(path(), {
      text: ' Second ',
      expected: { text: '  First ' },
    });
    expect(res.status).toBe(200);
    expect(res.body.text).toBe('Second');
  });

  it('still saves an edit that names no text, such as an agent’s', async () => {
    await api.patch(path(), { text: 'Second' });
    const res = await api.patch<Activity>(path(), { text: 'Third' });
    expect(res.status).toBe(200);
    expect((await current())?.text).toBe('Third');
  });

  it('sends the text it was typed over through the client', async () => {
    await api.patch(path(), { text: 'Second' });
    await expect(
      api.client().updateComment(comment.id, { text: 'Late' }, { text: 'First' }),
    ).rejects.toMatchObject({ status: 409, code: 'stale' });
    await api.client().updateComment(comment.id, { text: 'On top' }, { text: 'Second' });
    expect((await current())?.text).toBe('On top');
  });

  // On Postgres with several connections, an edit can commit after this one read the comment; the
  // write itself matches the text, so it refuses there too.
  it('writes only while the row still has the text it was typed over', async () => {
    await api.patch(path(), { text: 'Second' });
    const edit = { text: 'X', editedAt: Date.now() };
    expect(await updateActivityMatching(api.db, comment.id, 'First', edit)).toBe(false);
    expect((await current())?.text).toBe('Second');
    expect(await updateActivityMatching(api.db, comment.id, 'Second', edit)).toBe(true);
    expect((await current())?.text).toBe('X');
  });
});
