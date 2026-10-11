import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';
import { createMigrator, migrateToLatest } from '../../src/db/migrator';
import type { Db } from '../../src/db/schema';
import { DIALECTS, openEmptyDatabase } from '../helpers/server';

// 0011 gave the owner role to every account, so undoing it and running it again made each invited
// account an owner, and moved their projects to the first account (PT-142 review).
describe.each(DIALECTS)('undoing accounts and projects (%s)', (dialect) => {
  async function withDatabase(work: (db: Db) => Promise<void>): Promise<void> {
    const db = openEmptyDatabase(dialect);
    try {
      await work(db);
    } finally {
      await db.destroy();
    }
  }

  const addUser = (db: Db, id: string, createdAt: number) =>
    sql`insert into users (id, email, password_hash, created_at, updated_at)
      values (${id}, ${`${id}@example.com`}, 'hash', ${createdAt}, ${createdAt})`.execute(db);

  const roles = async (db: Db) =>
    (await sql<{ id: string; role: string }>`select id, role from users order by id`.execute(db))
      .rows;

  it('makes only the first account the owner', async () => {
    await withDatabase(async (db) => {
      await createMigrator(db).migrateTo('0010_ask_effort');
      await addUser(db, 'o', 1000);
      await addUser(db, 'u', 2000);
      await migrateToLatest(db);
      expect(await roles(db)).toEqual([
        { id: 'o', role: 'owner' },
        { id: 'u', role: 'user' },
      ]);
    });
  });

  it('refuses to undo it while invited accounts exist, and changes nothing', async () => {
    await withDatabase(async (db) => {
      await migrateToLatest(db);
      await addUser(db, 'o', 1000);
      await sql`update users set role = 'owner'`.execute(db);
      await addUser(db, 'u', 2000);
      await sql`insert into projects (id, name, key, description, repo, color, next_num,
        created_at, updated_at, owner_id)
        values ('p', 'Garden', 'GAR', '', '', '#5B5BD6', 1, 1000, 1000, 'u')`.execute(db);

      const { error } = await createMigrator(db).migrateTo('0010_ask_effort');
      expect(String(error)).toContain('invited accounts');
      expect(await roles(db)).toEqual([
        { id: 'o', role: 'owner' },
        { id: 'u', role: 'user' },
      ]);
      const owners = await sql<{ ownerId: string }>`select owner_id from projects`.execute(db);
      expect(owners.rows).toEqual([{ ownerId: 'u' }]);
    });
  });
});
