import type { ErrorBody, TicketMoves } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { statusOf } from '../helpers/fixtures';
import { DIALECTS, useTestServer } from '../helpers/server';

// PT-273 review: the undo of a move to Done took any 32-bit rank, so a ticket put back into To do
// at -2147483648 left the next ticket created there below Postgres's integer range (500), and
// SQLite stored -2147484648, which a move to Postgres can't hold.
describe.each(DIALECTS)('regression: an undo with a rank past the range (%s)', (dialect) => {
  const api = useTestServer(dialect);

  it('refuses the rank, and the next ticket in To do is still made', async () => {
    const project = await api.client().createProject({ name: 'Mobile app', key: 'MOB' });
    const status = (category: Parameters<typeof statusOf>[1]) => statusOf(project, category).id;
    await api.client().createTicket('MOB', { title: 'Approved', statusId: status('reviewed') });
    await api.client().moveToDone(['MOB-1']);

    for (const rank of [-2_147_483_648, 2_147_483_647]) {
      const undo = await api.post<ErrorBody>('/api/tickets/done/undo', {
        tickets: [{ key: 'MOB-1', statusId: status('todo'), rank }],
      });
      expect(undo.status).toBe(400);
    }

    const created = await api.post('/api/projects/MOB/tickets', { title: 'Next' });
    expect(created.status).toBe(201);
    expect((await api.client().getTicket('MOB-1')).status.category).toBe('done');
    const back = await api.post<TicketMoves>('/api/tickets/done/undo', {
      tickets: [{ key: 'MOB-1', statusId: status('todo'), rank: -1_000_000_000 }],
    });
    expect(back.body.moved).toHaveLength(1);
  });
});
