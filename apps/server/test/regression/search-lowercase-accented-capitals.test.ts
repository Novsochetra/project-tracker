import { beforeEach, describe, expect, it } from 'vitest';
import { DIALECTS, useTestServer } from '../helpers/server';

// PT-263: SQLite's lower() changes only A–Z, so on SQLite "été" missed a ticket titled "Été",
// while the JavaScript filter behind /api/tickets?q= found it.
describe.each(DIALECTS)('regression: lowercase words find accented capitals (%s)', (dialect) => {
  const api = useTestServer(dialect);

  beforeEach(async () => {
    const client = api.client();
    await client.createProject({ name: 'Website', key: 'WEB' });
    await client.createTicket('WEB', { title: 'Été en mer', description: 'Le CAFÉ ouvre.' });
    await client.createTicket('WEB', { title: 'Footer', description: 'Plain text.' });
  });

  it('finds "Été" with "été" and "CAFÉ" with "café"', async () => {
    const search = (query: string) => api.client().searchTickets({ q: query });
    const summer = await search('été');
    expect(summer.tickets).toEqual([expect.objectContaining({ key: 'WEB-1', match: 'title' })]);
    const cafe = await search('café');
    expect(cafe.tickets).toEqual([
      expect.objectContaining({ key: 'WEB-1', match: 'description', snippet: 'Le CAFÉ ouvre.' }),
    ]);
    expect((await search('ÉTÉ')).tickets.map((ticket) => ticket.key)).toEqual(['WEB-1']);
  });

  it('agrees with the ticket list filter', async () => {
    const listed = await api.client().listTickets('WEB', { q: 'été' });
    expect(listed.map((ticket) => ticket.key)).toEqual(['WEB-1']);
  });
});
