import { PGlite } from '@electric-sql/pglite';
import { PGliteDialect, PostgresAdapter, sql, type DialectAdapter, type Kysely } from 'kysely';
import type { Migration } from 'kysely/migration';
import { describe, expect, it } from 'vitest';
import { createKysely } from '../../src/db/createDatabase';
import {
  describeDatabase,
  migrateCommand,
  rollbackCommand,
  statusCommand,
} from '../../src/db/migrationCommands';
import { MIGRATIONS } from '../../src/db/migrations';
import { migrateToLatest, readMigrationState } from '../../src/db/migrator';
import type { Db } from '../../src/db/schema';
import { migratesOnStart, prepareDatabase } from '../../src/db/startup';
import { DIALECTS, openEmptyDatabase, type TestDialect } from '../helpers/server';

const NAMES = Object.keys(MIGRATIONS).sort();
const LAST = NAMES.at(-1)!;
const BEFORE_LAST = NAMES.at(-2)!;

async function withDatabase(dialect: TestDialect, work: (db: Db) => Promise<void>): Promise<void> {
  const db = openEmptyDatabase(dialect);
  try {
    await work(db);
  } finally {
    await db.destroy();
  }
}

const tableNames = async (db: Db) =>
  (await db.introspection.getTables()).map((table) => table.name);

const statuses = async (db: Db) =>
  (await readMigrationState(db)).map((state) => [state.name, state.status]);

// Creates a table, then fails, as a migration with a bug in its second statement would.
const BROKEN: Migration = {
  up: async (db: Kysely<unknown>) => {
    await db.schema.createTable('half_done').addColumn('id', 'text').execute();
    throw new Error('the second statement failed');
  },
  down: () => Promise.resolve(),
};

describe.each(DIALECTS)('migration commands (%s)', (dialect) => {
  it('migrates, says which migrations ran, and then that there is nothing to do', async () => {
    await withDatabase(dialect, async (db) => {
      expect(await migrateCommand(db)).toEqual({
        ok: true,
        lines: [...NAMES.map((name) => `Applied ${name}`), 'Up to date.'],
      });
      expect(await migrateCommand(db)).toEqual({
        ok: true,
        lines: ['Nothing to migrate: the database is up to date.'],
      });
    });
  });

  it('lists each migration as pending or applied', async () => {
    await withDatabase(dialect, async (db) => {
      const before = await statusCommand(db);
      expect(before.lines.slice(0, -1).every((line) => line.endsWith(' pending'))).toBe(true);
      expect(before.lines.at(-1)).toBe(`${NAMES.length} pending: db:migrate applies them.`);

      await migrateToLatest(db);
      const after = await statusCommand(db);
      expect(after.lines).toHaveLength(NAMES.length + 1);
      for (const [index, name] of NAMES.entries()) {
        expect(after.lines[index]).toMatch(new RegExp(`^${name} +applied \\d{4}-\\d\\d-\\d\\dT`));
      }
      expect(after.lines.at(-1)).toBe('Up to date.');
    });
  });

  it('rolls back only when told --yes, one migration at a time', async () => {
    await withDatabase(dialect, async (db) => {
      await migrateToLatest(db);
      expect(await rollbackCommand(db, false)).toEqual({
        ok: true,
        lines: [
          `Would undo ${LAST}: its down() removes what it added, with any data in it.`,
          'Run again with --yes to undo it.',
        ],
      });
      expect(await statuses(db)).toEqual(NAMES.map((name) => [name, 'applied']));

      expect(await rollbackCommand(db, true)).toEqual({
        ok: true,
        lines: [`Undid ${LAST}.`, `The database is now at ${BEFORE_LAST}.`],
      });
      expect((await statuses(db)).at(-1)).toEqual([LAST, 'pending']);
      expect((await statuses(db)).at(-2)).toEqual([BEFORE_LAST, 'applied']);
    });
  });

  it('has nothing to roll back before any migration has run', async () => {
    await withDatabase(dialect, async (db) => {
      expect(await rollbackCommand(db, true)).toEqual({
        ok: true,
        lines: ['Nothing to roll back: no migration has run.'],
      });
    });
  });

  it('keeps nothing of a run when one of its migrations fails', async () => {
    await withDatabase(dialect, async (db) => {
      await expect(migrateCommand(db, { ...MIGRATIONS, '9999_broken': BROKEN })).rejects.toThrow(
        'Migration 9999_broken failed, so none of this run was kept: the second statement failed',
      );
      expect(await tableNames(db)).not.toContain('half_done');
      expect(await tableNames(db)).not.toContain('projects');
      expect(await statuses(db)).toEqual(NAMES.map((name) => [name, 'pending']));
    });
  });

  it('refuses a database that has migrations from a newer build', async () => {
    await withDatabase(dialect, async (db) => {
      await migrateToLatest(db);
      await sql`insert into kysely_migration (name, timestamp)
        values ('9999_from_a_newer_build', '2026-10-09T12:00:00.000Z')`.execute(db);
      const refusal =
        "The database has migrations this build doesn't have: 9999_from_a_newer_build. " +
        'Run the build that added them, or undo them with that build first (db:rollback).';

      const status = await statusCommand(db);
      expect(status.lines.at(-2)).toMatch(
        /^9999_from_a_newer_build +applied 2026-10-09T12:00:00.000Z, by a build that has it/,
      );
      expect(status.lines.at(-1)).toBe(refusal);
      await expect(migrateCommand(db)).rejects.toThrow(refusal);
      expect(await rollbackCommand(db, true)).toEqual({ ok: false, lines: [refusal] });
      expect(await statuses(db)).toContainEqual([LAST, 'applied']);
    });
  });

  it('applies each migration once when two runs start at the same moment', async () => {
    await withDatabase(dialect, async (db) => {
      const [first, second] = await Promise.all([migrateToLatest(db), migrateToLatest(db)]);
      expect([...first, ...second].sort()).toEqual(NAMES);
      expect(await statuses(db)).toEqual(NAMES.map((name) => [name, 'applied']));
    });
  });
});

// PGlite is one connection, so Kysely skips the lock there; this gives it the adapter real Postgres
// gets, so the lock's SQL runs on Postgres' own code.
class PGliteWithPostgresLock extends PGliteDialect {
  override createAdapter(): DialectAdapter {
    return new PostgresAdapter();
  }
}

describe('the Postgres migration lock', () => {
  it('holds an advisory lock for the whole run and lets it go after', async () => {
    const db = createKysely(new PGliteWithPostgresLock({ pglite: new PGlite() }));
    const advisoryLocks = async (trx: Kysely<unknown>) =>
      (
        await sql<{ held: number }>`select count(*)::int as held from pg_locks
          where locktype = 'advisory' and granted`.execute(trx)
      ).rows[0]?.held;
    const seen: (number | undefined)[] = [];
    const noting: Migration = { up: async (trx) => void seen.push(await advisoryLocks(trx)) };
    try {
      expect(await migrateToLatest(db, { '0001_first': noting, '0002_second': noting })).toEqual([
        '0001_first',
        '0002_second',
      ]);
      expect(seen).toEqual([1, 1]);
      expect(await advisoryLocks(db.withoutPlugins() as Kysely<unknown>)).toBe(0);
    } finally {
      await db.destroy();
    }
  });
});

describe('starting the server', () => {
  it('migrates a SQLite file itself and leaves Postgres to the deploy', () => {
    expect(migratesOnStart('/data/tracker.db', {})).toBe(true);
    expect(migratesOnStart(':memory:', {})).toBe(true);
    expect(migratesOnStart('postgres://u@db.internal/railway', {})).toBe(false);
    expect(migratesOnStart('postgres://u@db.internal/railway', { MIGRATE_ON_START: '1' })).toBe(
      true,
    );
    expect(migratesOnStart('/data/tracker.db', { MIGRATE_ON_START: '0' })).toBe(false);
    expect(migratesOnStart('/data/tracker.db', { MIGRATE_ON_START: 'yes' })).toBe(true);
  });

  it('migrates SQLite on start and says which migrations ran', async () => {
    await withDatabase('sqlite', async (db) => {
      expect(await prepareDatabase(db, ':memory:', {})).toEqual(NAMES);
      expect(await prepareDatabase(db, ':memory:', {})).toEqual([]);
    });
  });

  it('refuses to start on Postgres until the deploy has migrated it', async () => {
    await withDatabase('pglite', async (db) => {
      const url = 'postgres://tracker@db.internal/railway';
      await expect(prepareDatabase(db, url, {})).rejects.toThrow(
        `The database is missing migrations this build needs: ${NAMES.join(', ')}. ` +
          'Run db:migrate first (the pre-deploy command), or start with MIGRATE_ON_START=1.',
      );
      expect(await tableNames(db)).toEqual([]);

      await migrateToLatest(db);
      expect(await prepareDatabase(db, url, {})).toEqual([]);

      await sql`insert into kysely_migration (name, timestamp)
        values ('9999_from_a_newer_build', '2026-10-09T12:00:00.000Z')`.execute(db);
      await expect(prepareDatabase(db, url, {})).rejects.toThrow(
        "The database has migrations this build doesn't have: 9999_from_a_newer_build.",
      );
    });
  });

  it('migrates Postgres on start when MIGRATE_ON_START=1', async () => {
    await withDatabase('pglite', async (db) => {
      const url = 'postgres://tracker@db.internal/railway';
      expect(await prepareDatabase(db, url, { MIGRATE_ON_START: '1' })).toEqual(NAMES);
    });
  });
});

describe('describeDatabase', () => {
  it('names a Postgres database without its password', () => {
    expect(
      describeDatabase('postgresql://postgres:s3cret@postgres.railway.internal:5432/railway'),
    ).toBe('Postgres railway on postgres.railway.internal:5432');
    expect(describeDatabase('postgres://u:p@db.example.com/tracker?sslmode=require')).toBe(
      'Postgres tracker on db.example.com:5432',
    );
    expect(describeDatabase('/srv/data/tracker.db')).toBe('SQLite /srv/data/tracker.db');
  });
});
