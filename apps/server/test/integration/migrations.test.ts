import { sql } from 'kysely';
import { Migrator } from 'kysely/migration';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import * as initial from '../../src/db/migrations/0001_initial';
import { migrateToLatest } from '../../src/db/migrator';
import type { Db } from '../../src/db/schema';
import { createBroadcaster } from '../../src/events/broadcaster';
import { createMemoryStorage } from '../../src/storage/memoryStorage';
import { clientFor, DIALECTS, openTestDatabase, type TestDialect } from '../helpers/server';

// A database from before client ids, with a project and two tickets in it, like the real one.
async function databaseWithTickets(dialect: TestDialect): Promise<Db> {
  const db = openTestDatabase(dialect);
  const migrator = new Migrator({
    db: db.withoutPlugins(),
    provider: { getMigrations: () => Promise.resolve({ '0001_initial': initial }) },
  });
  expect((await migrator.migrateToLatest()).error).toBeUndefined();
  await sql`insert into projects (id, name, key, description, repo, color, next_num, created_at, updated_at)
    values ('p-mob', 'Mobile app', 'MOB', '', '', '#5B5BD6', 3, 1000, 1000)`.execute(db);
  await sql`insert into statuses (id, project_id, name, category, color, position, created_at)
    values ('s-todo', 'p-mob', 'To do', 'todo', '#8E8E99', 0, 1000)`.execute(db);
  for (const num of [1, 2]) {
    await sql`insert into tickets (id, project_id, num, status_id, rank, title, description,
      priority, assignee, due, created_at, updated_at)
      values (${`t-${num}`}, 'p-mob', ${num}, 's-todo', ${num * 1000}, ${`Old idea ${num}`}, '',
      'medium', '', '', 1000, 1000)`.execute(db);
  }
  return db;
}

describe.each(DIALECTS)('migrations (%s)', (dialect) => {
  it('adds client ids to a database that has tickets, which stay as they were', async () => {
    const db = await databaseWithTickets(dialect);
    try {
      await migrateToLatest(db);
      const client = clientFor(
        createApp({ db, storage: createMemoryStorage(), events: createBroadcaster() }),
      );

      const before = await client.listTickets('MOB');
      expect(before.map((ticket) => [ticket.key, ticket.title])).toEqual([
        ['MOB-1', 'Old idea 1'],
        ['MOB-2', 'Old idea 2'],
      ]);
      const first = await client.createTicket('MOB', { title: 'New idea', clientId: 'c-1' });
      const again = await client.createTicket('MOB', { title: 'New idea', clientId: 'c-1' });
      expect(first.key).toBe('MOB-3');
      expect(again).toEqual(first);
      await client.createTicket('MOB', { title: 'Without an id' });
      await client.createTicket('MOB', { title: 'Without an id' });
      expect(await client.listTickets('MOB')).toHaveLength(5);
    } finally {
      await db.destroy();
    }
  });
});
