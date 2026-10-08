import type { Ticket } from '@tracker/shared';
import type { KyselyPlugin } from 'kysely';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { DIALECTS, useTestServer } from '../helpers/server';

const CLIENT_ID = '5f0e2c1a-8d3b-4c6e-a7f9-1b2d3e4f5a6b';

// On Postgres with a pool, the second of two identical creates at once looks the client id up
// before the first one commits, misses it, and then meets the unique index: it answered 500.
// SQLite and PGlite run one transaction at a time (PGlite's dialect locks the instance for each
// transaction, so a second Kysely on it waits), so the race can't happen there. This plugin makes
// the lookup miss as it does on Postgres; the insert, the index and the rollback are real.
function lookupBeforeTheFirstCommit(clientId: string): KyselyPlugin {
  const missed = new Set<string>();
  return {
    transformQuery: ({ node, queryId }) => {
      const isLookup = node.kind === 'SelectQueryNode' && JSON.stringify(node).includes(clientId);
      if (isLookup && missed.size === 0) missed.add(queryId.queryId);
      return node;
    },
    transformResult: ({ queryId, result }) =>
      Promise.resolve(missed.has(queryId.queryId) ? { ...result, rows: [] } : result),
  };
}

describe.each(DIALECTS)('two identical creates at the same moment (%s)', (dialect) => {
  const api = useTestServer(dialect);

  it('answers the one that loses the race with the ticket the first one made', async () => {
    await api.client().createProject({ name: 'Mobile app', key: 'MOB' });
    const first = await api.post<Ticket>('/api/projects/MOB/tickets', {
      title: 'Idea',
      clientId: CLIENT_ID,
    });
    api.events.length = 0;
    const racing = createApp({
      db: api.db.withPlugin(lookupBeforeTheFirstCommit(CLIENT_ID)),
      storage: api.storage,
      events: api.broadcaster,
    });

    const second = await racing.request('/api/projects/MOB/tickets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Idea', clientId: CLIENT_ID }),
    });

    expect(second.status).toBe(201);
    expect(await second.json()).toEqual(first.body);
    expect((await api.client().listTickets('MOB')).map((ticket) => ticket.key)).toEqual(['MOB-1']);
    const detail = await api.client().getTicket('MOB-1');
    expect(detail.project.nextNum).toBe(2);
    expect(detail.activity.map((item) => item.text)).toEqual(['created the ticket']);
    expect(api.events).toEqual([]);
  });
});
