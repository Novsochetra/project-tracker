import type { ErrorBody, Ticket } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { DIALECTS, useTestServer } from '../helpers/server';

// A client that may send a create twice (quick capture after a lost answer, or from two tabs)
// sends its own id for the ticket; the tracker makes one ticket per id and project.
const CLIENT_ID = '0c6f1d2e-5b7a-4e3c-9d18-7a2b4c6e8f10';

describe.each(DIALECTS)('create with a client id (%s)', (dialect) => {
  const api = useTestServer(dialect);

  beforeEach(async () => {
    await api.client().createProject({ name: 'Mobile app', key: 'MOB' });
    api.events.length = 0;
  });

  const create = (body: Record<string, unknown>, projectKey = 'MOB') =>
    api.post<Ticket>(`/api/projects/${projectKey}/tickets`, body);

  const keys = async (projectKey = 'MOB') =>
    (await api.client().listTickets(projectKey)).map((ticket) => ticket.key);

  it('answers a repeat with the ticket the first request made', async () => {
    const first = await create({ title: 'Idea from the bus', clientId: CLIENT_ID });
    const again = await create({ title: 'Idea from the bus', clientId: CLIENT_ID });

    expect(first.status).toBe(201);
    expect(again.status).toBe(201);
    expect(again.body).toEqual(first.body);
    expect(await keys()).toEqual(['MOB-1']);
    const detail = await api.client().getTicket('MOB-1');
    expect(detail.activity.map((item) => item.text)).toEqual(['created the ticket']);
    expect(detail.project.nextNum).toBe(2);
    expect(api.events).toHaveLength(1);
  });

  it('makes one ticket of two identical creates at the same moment, with no gap in numbers', async () => {
    const [one, two] = await Promise.all([
      create({ title: 'Idea', clientId: CLIENT_ID }),
      create({ title: 'Idea', clientId: CLIENT_ID }),
    ]);

    expect([one.status, two.status]).toEqual([201, 201]);
    expect(two.body).toEqual(one.body);
    expect(await keys()).toEqual(['MOB-1']);
    expect((await create({ title: 'Next idea' })).body.key).toBe('MOB-2');
  });

  it('answers a late repeat with the ticket as it is now, changing nothing', async () => {
    await create({ title: 'Idea', clientId: CLIENT_ID });
    const edited = await api.client().updateTicket('MOB-1', { title: 'Idea, edited' });

    const late = await create({ title: 'Idea', priority: 'high', clientId: CLIENT_ID });

    expect(late.status).toBe(201);
    expect(late.body).toEqual(edited);
    expect(await keys()).toEqual(['MOB-1']);
  });

  it('lets another project use the same client id', async () => {
    await api.client().createProject({ name: 'Website', key: 'WEB' });

    const mobile = await create({ title: 'Idea', clientId: CLIENT_ID });
    const website = await create({ title: 'Idea', clientId: CLIENT_ID }, 'WEB');

    expect(mobile.body.key).toBe('MOB-1');
    expect(website.body.key).toBe('WEB-1');
    expect(website.body.id).not.toBe(mobile.body.id);
  });

  it('creates a ticket for every request without a client id, as before', async () => {
    await create({ title: 'Idea' });
    await create({ title: 'Idea' });

    expect(await keys()).toEqual(['MOB-2', 'MOB-1']);
  });

  it('refuses a client id longer than 64 characters', async () => {
    const res = await api.post<ErrorBody>('/api/projects/MOB/tickets', {
      title: 'Idea',
      clientId: 'x'.repeat(65),
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_input');
    expect(await keys()).toEqual([]);
  });
});
