import {
  CompiledQuery,
  SqliteAdapter,
  SqliteDialect,
  SqliteDriver,
  type DatabaseConnection,
  type DialectAdapter,
  type Driver,
  type SqliteDatabase,
} from 'kysely';

// SQLite can roll back DDL, but Kysely assumes it can't and runs migrations outside a transaction,
// so a failing one left half its changes. With this the migrator wraps a run in one transaction, as
// it does on Postgres.
class TransactionalDdlAdapter extends SqliteAdapter {
  override get supportsTransactionalDdl(): boolean {
    return true;
  }
}

// A deferred BEGIN takes the write lock only at its first write, and in WAL mode a transaction that
// read before another process wrote then fails at once instead of waiting. IMMEDIATE takes the lock
// up front and waits for it (busy_timeout), so a second process migrating the same file waits, then
// finds the work done. The server has one connection, so its own transactions are unchanged.
class ImmediateDriver extends SqliteDriver {
  override async beginTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw('begin immediate'));
  }
}

export class TrackerSqliteDialect extends SqliteDialect {
  readonly #database: SqliteDatabase;

  constructor(database: SqliteDatabase) {
    super({ database });
    this.#database = database;
  }

  override createAdapter(): DialectAdapter {
    return new TransactionalDdlAdapter();
  }

  override createDriver(): Driver {
    return new ImmediateDriver({ database: this.#database });
  }
}
