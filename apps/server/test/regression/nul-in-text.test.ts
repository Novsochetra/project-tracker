import { describe, expect, it } from 'vitest';
import { agent } from '../helpers/fixtures';
import { DIALECTS, useTestServer } from '../helpers/server';

// Postgres refused a NUL in text (22021) and every such write answered 500, while SQLite kept it.
describe.each(DIALECTS)('a NUL character in text (%s)', (dialect) => {
  const api = useTestServer(dialect);

  it('is dropped wherever text is kept', async () => {
    const person = api.client();
    await person.createProject({ name: 'Mobile app', description: 'Phone\u0000 app' });
    await person.createTicket('MA', {
      title: 'Cr\u0000ash',
      description: 'On\u0000 launch',
      assignee: 'Ma\u0000ya',
    });
    await api.client(agent('Claude\u0000 Worker')).addComment('MA-1', { text: 'Lo\u0000gs' });
    const status = await api.post('/api/projects/MA/statuses', {
      name: 'Blo\u0000cked',
      category: 'in_progress',
    });
    expect(status.status).toBe(201);

    const detail = await person.getTicket('MA-1');
    expect(detail.project.description).toBe('Phone app');
    expect(detail.ticket).toMatchObject({
      title: 'Crash',
      description: 'On launch',
      assignee: 'Maya',
    });
    expect(detail.activity.at(-1)).toMatchObject({
      text: 'Logs',
      actor: { kind: 'agent', name: 'Claude Worker' },
    });
    expect(detail.statuses.map((item) => item.name)).toContain('Blocked');
  });
});
