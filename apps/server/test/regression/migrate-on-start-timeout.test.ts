import { sql, type Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';
import { describe, expect, it } from 'vitest';
import { prepareDatabase } from '../../src/db/startup';
import { openEmptyDatabase } from '../helpers/server';

const TIMEOUT = sql<{ timeout: string }>`select current_setting('statement_timeout') as timeout`;

const timeoutOf = async <T>(db: Kysely<T>) => (await TIMEOUT.execute(db)).rows[0]?.timeout;

// db.js migrates without the pool's statement timeout (30 s), since a migration may rewrite a whole
// table; MIGRATE_ON_START=1 ran the same migrations, and the wait for another server's migration
// lock, under it. PGlite enforces no timeout, so the test reads the setting the migration ran with.
describe('MIGRATE_ON_START=1 on Postgres', () => {
  it('migrates without the statement timeout and puts it back after', async () => {
    const db = openEmptyDatabase('pglite');
    const seen: (string | undefined)[] = [];
    const noting: Migration = { up: async (trx) => void seen.push(await timeoutOf(trx)) };
    try {
      await sql`set statement_timeout = '30s'`.execute(db);
      const url = 'postgres://tracker@db.internal/railway';
      const env = { MIGRATE_ON_START: '1' };
      const migrations = { '0001_first': noting, '0002_second': noting };

      expect(await prepareDatabase(db, url, env, migrations)).toEqual([
        '0001_first',
        '0002_second',
      ]);
      expect(seen).toEqual(['0', '0']);
      expect(await timeoutOf(db)).toBe('30s');
    } finally {
      await db.destroy();
    }
  });
});
