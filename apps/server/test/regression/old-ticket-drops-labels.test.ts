import type { ErrorBody, Label, Ticket } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { setTicketLabels } from '../../src/repositories/ticketLabels';
import { DIALECTS, useTestServer } from '../helpers/server';

// PT-220 review: a ticket saved with more labels than the new cap of 10 (up to 50 before) could
// not drop one, since the app sends the whole list and the tracker refused any over 10.
describe.each(DIALECTS)('a ticket over the label cap (%s)', (dialect) => {
  const api = useTestServer(dialect);

  it('can drop labels, but not add one past 10', async () => {
    await api.client().createProject({ name: 'Mobile app' });
    const ids: string[] = [];
    for (let index = 0; index < 13; index += 1) {
      ids.push((await api.client().createLabel('MA', { name: `L${index}` })).id);
    }
    const ticket = await api.client().createTicket('MA', { title: 'Crash' });
    await setTicketLabels(api.db, ticket.id, ids.slice(0, 12), Date.now());

    const dropped = await api.patch<Ticket>('/api/tickets/MA-1', { labelIds: ids.slice(0, 11) });
    expect(dropped.status).toBe(200);
    expect(dropped.body.labelIds).toHaveLength(11);

    const swapped = await api.patch<Ticket>('/api/tickets/MA-1', { labelIds: ids.slice(2, 13) });
    expect(swapped.status).toBe(200);
    expect(swapped.body.labelIds).toHaveLength(11);

    const grown = await api.patch<ErrorBody>('/api/tickets/MA-1', { labelIds: ids.slice(0, 12) });
    expect(grown.status).toBe(400);
    expect(grown.body.error.message).toBe('A ticket can have up to 10 labels.');

    const back = await api.patch<Ticket>('/api/tickets/MA-1', { labelIds: ids.slice(0, 10) });
    expect(back.body.labelIds).toHaveLength(10);
    const again = await api.patch<ErrorBody>('/api/tickets/MA-1', { labelIds: ids.slice(0, 11) });
    expect(again.status).toBe(400);
  });

  it('keeps new tickets to 10 labels', async () => {
    await api.client().createProject({ name: 'Mobile app' });
    const labels: Label[] = [];
    for (let index = 0; index < 11; index += 1) {
      labels.push(await api.client().createLabel('MA', { name: `L${index}` }));
    }
    const res = await api.post<ErrorBody>('/api/projects/MA/tickets', {
      title: 'x',
      labelIds: labels.map((label) => label.id),
    });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('A ticket can have up to 10 labels.');
  });
});
