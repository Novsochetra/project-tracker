import { sql } from 'kysely';
import { Migrator, type Migration } from 'kysely/migration';
import { describe, expect, it } from 'vitest';
import * as initial from '../../src/db/migrations/0001_initial';
import * as ticketClientId from '../../src/db/migrations/0002_ticket_client_id';
import * as attachmentPosition from '../../src/db/migrations/0003_attachment_position';
import * as ownerAuth from '../../src/db/migrations/0004_owner_auth';
import type { Db } from '../../src/db/schema';
import { DIALECTS, openEmptyDatabase } from '../helpers/server';

const MIGRATIONS: Record<string, Migration> = {
  '0001_initial': initial,
  '0002_ticket_client_id': ticketClientId,
  '0003_attachment_position': attachmentPosition,
  '0004_owner_auth': ownerAuth,
};

const migratorFor = (db: Db) =>
  new Migrator({
    db: db.withoutPlugins(),
    provider: { getMigrations: () => Promise.resolve(MIGRATIONS) },
  });

const AUTH_TABLES = ['users', 'sessions', 'api_tokens'];

async function tableNames(db: Db): Promise<string[]> {
  const tables = await db.introspection.getTables();
  return tables.map((table) => table.name).filter((name) => !name.startsWith('kysely_'));
}

async function addOwnerRows(db: Db): Promise<void> {
  await sql`insert into users (id, email, password_hash, created_at, updated_at)
    values ('u1', 'owner@example.com', 'scrypt$1$1$1$a$b', 1, 1)`.execute(db);
  await sql`insert into sessions (id, user_id, created_at, last_seen_at, expires_at)
    values ('s-hash', 'u1', 1, 1, 2)`.execute(db);
  await sql`insert into api_tokens (id, user_id, name, hint, token_hash, created_at, last_used_at)
    values ('t1', 'u1', 'Claude laptop', 'trk_abcd', 't-hash', 1, null)`.execute(db);
}

const count = async (db: Db, table: string) =>
  (await sql<{ n: number }>`select count(*) as n from ${sql.table(table)}`.execute(db)).rows[0]!.n;

describe.each(DIALECTS)('owner sign-in migration (%s)', (dialect) => {
  it('adds the users, sessions and api_tokens tables and takes them away again', async () => {
    const db = openEmptyDatabase(dialect);
    try {
      const migrator = migratorFor(db);
      expect((await migrator.migrateTo('0003_attachment_position')).error).toBeUndefined();
      await sql`insert into projects (id, name, key, description, repo, color, next_num,
        created_at, updated_at) values ('p1', 'Mobile', 'MOB', '', '', '#5B5BD6', 1, 1, 1)`.execute(
        db,
      );
      expect(await tableNames(db)).not.toContain('users');

      expect((await migrator.migrateUp()).error).toBeUndefined();
      expect(await tableNames(db)).toEqual(expect.arrayContaining(AUTH_TABLES));
      await addOwnerRows(db);

      const down = await migrator.migrateDown();
      expect(down.error).toBeUndefined();
      expect(down.results?.map((result) => [result.migrationName, result.direction])).toEqual([
        ['0004_owner_auth', 'Down'],
      ]);
      for (const table of AUTH_TABLES) expect(await tableNames(db)).not.toContain(table);
      expect(await count(db, 'projects')).toBe(1);

      expect((await migrator.migrateUp()).error).toBeUndefined();
      expect(await count(db, 'users')).toBe(0);
    } finally {
      await db.destroy();
    }
  });

  it('keeps one account per email and one row per token, and drops both with their owner', async () => {
    const db = openEmptyDatabase(dialect);
    try {
      expect((await migratorFor(db).migrateToLatest()).error).toBeUndefined();
      await addOwnerRows(db);
      await expect(
        sql`insert into users (id, email, password_hash, created_at, updated_at)
          values ('u2', 'owner@example.com', 'x', 1, 1)`.execute(db),
      ).rejects.toThrow();
      await expect(
        sql`insert into api_tokens (id, user_id, name, hint, token_hash, created_at)
          values ('t2', 'u1', 'Again', 'trk_x', 't-hash', 1)`.execute(db),
      ).rejects.toThrow();
      await expect(
        sql`insert into sessions (id, user_id, created_at, last_seen_at, expires_at)
          values ('s2', 'nobody', 1, 1, 2)`.execute(db),
      ).rejects.toThrow();

      await sql`delete from users where id = 'u1'`.execute(db);
      expect(await count(db, 'sessions')).toBe(0);
      expect(await count(db, 'api_tokens')).toBe(0);
    } finally {
      await db.destroy();
    }
  });
});
