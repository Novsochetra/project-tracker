import type { ProjectDetail, Ticket, TicketDetail } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { createClock } from '../../src/clock';
import { DIALECTS, useTestServer } from '../helpers/server';

// Each activity used to read the clock again, so an operation that crossed a millisecond
// stamped its rows now, now+3, now+7… instead of now, now+1, now+2.
describe.each(DIALECTS)('activity stamps within one operation (%s)', (dialect) => {
  let time = 1_000_000;
  const api = useTestServer(dialect, { now: createClock(() => (time += 5)) });

  it('are consecutive milliseconds even when the wall clock moves', async () => {
    const project = (await api.post<ProjectDetail>('/api/projects', { name: 'Mobile app' })).body;
    const ticket = (await api.post<Ticket>('/api/projects/MA/tickets', { title: 'Crash' })).body;
    const done = project.statuses.find((status) => status.category === 'done')!;
    await api.patch(`/api/tickets/${ticket.key}`, {
      statusId: done.id,
      priority: 'high',
      assignee: 'Dara',
    });

    const detail = (await api.get<TicketDetail>(`/api/tickets/${ticket.key}`)).body;
    const [first, ...rest] = detail.activity.slice(1).map((item) => item.createdAt);
    expect(rest).toEqual([first! + 1, first! + 2]);
    expect(detail.ticket.updatedAt).toBe(first);
  });
});
