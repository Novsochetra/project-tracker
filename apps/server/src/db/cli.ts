import { databaseUrlOf } from '../config';
import { createDatabase } from './createDatabase';
import {
  describeDatabase,
  migrateCommand,
  rollbackCommand,
  statusCommand,
  type CommandResult,
} from './migrationCommands';
import type { Db } from './schema';

const USAGE = `Usage: db <command>
  migrate          Run every pending migration, all in one transaction.
  rollback --yes   Undo the last migration. Without --yes it only says which one it would undo.
  status           List migrations: applied, pending, or applied by a build this one lacks.
The database is DATABASE_URL (a SQLite file or postgres://…), else data/tracker.db.
`;

const COMMANDS: Record<string, (db: Db, args: string[]) => Promise<CommandResult>> = {
  migrate: (db) => migrateCommand(db),
  rollback: (db, args) => rollbackCommand(db, args.includes('--yes')),
  status: (db) => statusCommand(db),
};

async function run(command: (db: Db, args: string[]) => Promise<CommandResult>, args: string[]) {
  const url = databaseUrlOf(process.env);
  process.stdout.write(`Database: ${describeDatabase(url)}\n`);
  // A migration may rewrite a whole table, which the server's statement timeout would cut short.
  const db = createDatabase(url, { ...process.env, DATABASE_STATEMENT_TIMEOUT_MS: '0' });
  try {
    const result = await command(db, args);
    process.stdout.write(`${result.lines.join('\n')}\n`);
    return result.ok ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return 1;
  } finally {
    await db.destroy();
  }
}

const [name = '', ...args] = process.argv.slice(2);
const command = COMMANDS[name];
if (command) {
  process.exitCode = await run(command, args);
} else {
  process.stderr.write(USAGE);
  process.exitCode = 2;
}
