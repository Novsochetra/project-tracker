import type { ErrorBody } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { DIALECTS, useTestServer } from '../helpers/server';

// Where SQLite and Postgres differ (text, integer range, the types they hand back, case), the
// tracker must answer the same on both. The NUL and image-size cases are in test/regression.
describe.each(DIALECTS)('the same answers on SQLite and Postgres (%s)', (dialect) => {
  const api = useTestServer(dialect);

  it('keeps every other character as it was sent', async () => {
    const title = 'Crash 🐛 on 起動 — naïve café (é), tab\there';
    await api.client().createProject({ name: 'Mobile app' });
    await api.client().createTicket('MA', { title, description: 'x'.repeat(50_000) });
    const { ticket } = await api.client().getTicket('MA-1');
    expect(ticket.title).toBe(title);
    expect(ticket.description).toHaveLength(50_000);
  });

  it('answers 404 for a ticket number past the integer range', async () => {
    await api.client().createProject({ name: 'Mobile app' });
    for (const key of ['MA-2147483647', 'MA-2147483648', 'MA-99999999999']) {
      const res = await api.get<ErrorBody>(`/api/tickets/${key}`);
      expect(res.status, key).toBe(404);
    }
  });

  it('hands back counts and epoch-ms times as numbers', async () => {
    const before = Date.now();
    await api.client().createProject({ name: 'Mobile app' });
    await api.client().createTicket('MA', { title: 'Crash' });
    const [summary] = await api.client().listProjects();
    expect(summary).toMatchObject({ totalCount: 1, openCount: 1, doneCount: 0 });
    expect(typeof summary?.lastActivityAt).toBe('number');
    expect(summary!.lastActivityAt).toBeGreaterThanOrEqual(before);
    const [item] = await api.client().listTickets('MA');
    expect(item).toMatchObject({ commentCount: 0, attachmentCount: 0 });
    expect(typeof item?.createdAt).toBe('number');
  });

  it('matches status names and searches without regard to case', async () => {
    await api.client().createProject({ name: 'Mobile app' });
    await api.client().createTicket('MA', { title: 'Crash on Launch' });
    const clash = await api.post<ErrorBody>('/api/projects/MA/statuses', {
      name: 'TO DO',
      category: 'todo',
    });
    expect(clash.status).toBe(409);
    const found = await api.client().listTickets('MA', { q: 'launch', status: 'to do' });
    expect(found.map((ticket) => ticket.key)).toEqual(['MA-1']);
  });
});
