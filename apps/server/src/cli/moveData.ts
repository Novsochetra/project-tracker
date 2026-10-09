import { existsSync } from 'node:fs';
import { MOVE_USAGE, parseMoveArgs, type MoveArgs } from '../dataMove/moveArgs';
import { moveTargetSettings } from '../dataMove/moveTarget';
import { runMove } from '../dataMove/runMove';
import { createDatabase, isPostgresUrl } from '../db/createDatabase';
import { describeDatabase } from '../db/migrationCommands';
import { describeStorage, openFileStorage } from '../storage/openFileStorage';

const say = (line: string) => process.stdout.write(`${line}\n`);

// A dry run only reads the target. Opening a SQLite file creates it, so one that isn't there yet
// is read as the empty database it would be.
const readableTarget = (url: string, dryRun: boolean): string =>
  dryRun && !isPostgresUrl(url) && !existsSync(url) ? ':memory:' : url;

// Says where things go without DATABASE_URL's password or any AWS key.
async function move(args: MoveArgs): Promise<number> {
  const target = moveTargetSettings(process.env, args);
  say(`From: ${args.from} and ${args.uploads} (only read)`);
  say(`To: ${describeDatabase(target.databaseUrl)}; files in ${describeStorage(target.storage)}`);
  // Migrations and large inserts run without the server's statement timeout.
  const env = { ...process.env, DATABASE_STATEMENT_TIMEOUT_MS: '0' };
  const db = createDatabase(readableTarget(target.databaseUrl, args.dryRun), env);
  try {
    const storage = await openFileStorage(target.storage);
    return (await runMove(args, { db, storage, say })) ? 0 : 1;
  } finally {
    await db.destroy();
  }
}

async function run(): Promise<number> {
  const args = parseMoveArgs(process.argv.slice(2));
  if ('help' in args) {
    say(MOVE_USAGE);
    return 0;
  }
  if ('error' in args) {
    console.error(`${args.error}\n\n${MOVE_USAGE}`);
    return 2;
  }
  return move(args);
}

// The exit code alone ends it: process.exit could cut off output still on its way down a pipe.
run().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  },
);
