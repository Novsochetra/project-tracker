import { isPostgresUrl } from './createDatabase';
import { MIGRATIONS } from './migrations';
import {
  migrateToLatest,
  namesWith,
  readMigrationState,
  rollbackLast,
  unknownMigrationsMessage,
  type MigrationState,
  type Migrations,
} from './migrator';
import type { Db } from './schema';

export interface CommandResult {
  ok: boolean;
  lines: string[];
}

// Names the database without its password, so the output can be pasted anywhere: db.js prints it
// first, in a deploy's log. A value with :// that isn't a readable postgres:// URL (a password with
// an unencoded # or /, a port typo, quotes pasted around it) is never shown.
export function describeDatabase(url: string): string {
  if (isPostgresUrl(url) && URL.canParse(url)) {
    const { hostname, port, pathname } = new URL(url);
    return `Postgres ${decodeURIComponent(pathname.slice(1))} on ${hostname}:${port || '5432'}`;
  }
  if (isPostgresUrl(url)) return 'Postgres (DATABASE_URL could not be read)';
  if (url.includes('://')) return 'DATABASE_URL that is neither postgres:// nor a file path';
  return `SQLite ${url}`;
}

export async function migrateCommand(
  db: Db,
  migrations: Migrations = MIGRATIONS,
): Promise<CommandResult> {
  const ran = await migrateToLatest(db, migrations);
  if (ran.length === 0)
    return { ok: true, lines: ['Nothing to migrate: the database is up to date.'] };
  return { ok: true, lines: [...ran.map((name) => `Applied ${name}`), 'Up to date.'] };
}

const lastApplied = (states: readonly MigrationState[]): string | undefined =>
  namesWith(states, 'applied').at(-1);

export async function rollbackCommand(
  db: Db,
  confirmed: boolean,
  migrations: Migrations = MIGRATIONS,
): Promise<CommandResult> {
  const states = await readMigrationState(db, migrations);
  const unknown = namesWith(states, 'unknown');
  if (unknown.length > 0) return { ok: false, lines: [unknownMigrationsMessage(unknown)] };
  const last = lastApplied(states);
  if (!last) return { ok: true, lines: ['Nothing to roll back: no migration has run.'] };
  if (!confirmed) {
    return {
      ok: true,
      lines: [
        `Would undo ${last}: its down() removes what it added, with any data in it.`,
        'Run again with --yes to undo it.',
      ],
    };
  }
  const undone = await rollbackLast(db, migrations);
  const now = lastApplied(await readMigrationState(db, migrations)) ?? 'no migrations';
  return { ok: true, lines: [`Undid ${undone}.`, `The database is now at ${now}.`] };
}

function describeState(state: MigrationState): string {
  if (state.status === 'pending') return 'pending';
  const applied = `applied ${state.appliedAt}`;
  return state.status === 'applied' ? applied : `${applied}, by a build that has it and this lacks`;
}

function statusSummary(states: readonly MigrationState[]): string {
  const unknown = namesWith(states, 'unknown');
  if (unknown.length > 0) return unknownMigrationsMessage(unknown);
  const pending = namesWith(states, 'pending').length;
  return pending === 0 ? 'Up to date.' : `${pending} pending: db:migrate applies them.`;
}

export async function statusCommand(
  db: Db,
  migrations: Migrations = MIGRATIONS,
): Promise<CommandResult> {
  const states = await readMigrationState(db, migrations);
  const width = Math.max(...states.map((state) => state.name.length));
  return {
    ok: true,
    lines: [
      ...states.map((state) => `${state.name.padEnd(width)}  ${describeState(state)}`),
      statusSummary(states),
    ],
  };
}
