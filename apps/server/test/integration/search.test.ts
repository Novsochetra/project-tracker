import type { ErrorBody, TicketSearchResults } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { DIALECTS, useTestServer } from '../helpers/server';

const keys = (results: TicketSearchResults) => results.tickets.map((ticket) => ticket.key);

describe.each(DIALECTS)('GET /api/search (%s)', (dialect) => {
  const api = useTestServer(dialect);
  const search = (q: string, limit?: number) => api.client().searchTickets({ q, limit });

  beforeEach(async () => {
    const client = api.client();
    await client.createProject({ name: 'Mobile app', key: 'MOB' });
    await client.createProject({ name: 'Website', key: 'WEB' });
    await client.createTicket('MOB', {
      title: 'Crash on rotate',
      description: 'Open the camera.\nTurn the phone and the app closes.',
    });
    await client.createTicket('MOB', { title: 'Cache avatars', description: 'Rotate keys too.' });
    await client.createTicket('WEB', { title: 'Pricing layout', description: '100% width_bug' });
    await client.createTicket('WEB', { title: 'Footer', description: 'Plain text.' });
  });

  it('finds titles and descriptions, title matches first, case-insensitively', async () => {
    const res = await search('ROTATE');
    expect(keys(res)).toEqual(['MOB-1', 'MOB-2']);
    expect(res.tickets[0]).toMatchObject({
      projectKey: 'MOB',
      num: 1,
      title: 'Crash on rotate',
      statusName: 'To do',
      statusCategory: 'todo',
      match: 'title',
      snippet: null,
    });
    expect(res.tickets[1]).toMatchObject({ match: 'description', snippet: 'Rotate keys too.' });
  });

  it('needs every word, each in the title or the description', async () => {
    expect(keys(await search('phone crash'))).toEqual(['MOB-1']);
    const [hit] = (await search('phone crash')).tickets;
    expect(hit?.snippet).toBe('…Turn the phone and the app closes.');
    expect(keys(await search('phone pricing'))).toEqual([]);
  });

  it('puts a ticket key first, however it is written', async () => {
    for (const q of ['WEB-2', 'web 2', 'web2']) {
      const res = await search(q);
      expect(res.tickets[0], q).toMatchObject({ key: 'WEB-2', match: 'key' });
    }
    expect(keys(await search('2'))).toEqual(['WEB-2', 'MOB-2']);
  });

  it('finds words with accented letters, capitals included, typed as written', async () => {
    await api.client().createTicket('WEB', { title: 'Été en mer', description: 'Le Café ouvre.' });
    const summer = await search('Été');
    expect(summer.tickets).toEqual([expect.objectContaining({ key: 'WEB-3', match: 'title' })]);
    const cafe = await search('Café');
    expect(cafe.tickets).toEqual([
      expect.objectContaining({ key: 'WEB-3', match: 'description', snippet: 'Le Café ouvre.' }),
    ]);
    expect(keys(await search('Été MER'))).toEqual(['WEB-3']);
  });

  it('matches LIKE wildcards as plain text', async () => {
    expect(keys(await search('100%'))).toEqual(['WEB-1']);
    expect(keys(await search('h_b'))).toEqual(['WEB-1']);
    expect(keys(await search('%'))).toEqual(['WEB-1']);
    expect(keys(await search('_'))).toEqual(['WEB-1']);
  });

  it('lists recent tickets for an empty search, newest first, up to the limit', async () => {
    await api.client().updateTicket('MOB-1', { title: 'Crash on rotate!' });
    const res = await search('', 3);
    expect(keys(res)).toEqual(['MOB-1', 'WEB-2', 'WEB-1']);
    expect(res.tickets.every((ticket) => ticket.match === 'recent')).toBe(true);
  });

  it('refuses a limit past the cap', async () => {
    const res = await api.get<ErrorBody>('/api/search?q=a&limit=500');
    expect(res.status).toBe(400);
  });
});
