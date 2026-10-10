import { MOVE_USAGE, parseMoveArgs, type MoveArgs } from '../dataMove/moveArgs';
import { moveTargetSettings } from '../dataMove/moveTarget';
import { runMove } from '../dataMove/runMove';
import { removeSourceCopies } from '../dataMove/sourceCopy';
import { stoppedLine, type MovePhase } from '../dataMove/stopped';
import { createDatabase } from '../db/createDatabase';
import { describeDatabase } from '../db/migrationCommands';
import { describeStorage, openFileStorage } from '../storage/openFileStorage';

const say = (line: string) => process.stdout.write(`${line}\n`);

let phase: MovePhase = 'no-rows';

// Ctrl-C would end the process without the move's cleanup, leaving the copy of the whole
// database in the temp folder. An open transaction ends with the connection, uncommitted.
for (const [signal, code] of [
  ['SIGINT', 130],
  ['SIGTERM', 143],
] as const) {
  process.once(signal, () => {
    removeSourceCopies();
    console.error(`Stopped (${signal}). ${stoppedLine(phase)}`);
    process.exit(code);
  });
}
process.once('exit', removeSourceCopies);

// Says where things go without DATABASE_URL's password or any AWS key.
async function move(args: MoveArgs): Promise<number> {
  const { databaseUrl, s3 } = moveTargetSettings(process.env);
  const storage = { s3, uploadsDir: '' };
  say(`From: ${args.from} and ${args.uploads} (only read)`);
  say(`To: ${describeDatabase(databaseUrl)}; files in ${describeStorage(storage)}`);
  // Migrations and large inserts run without the server's statement timeout.
  const db = createDatabase(databaseUrl, { ...process.env, DATABASE_STATEMENT_TIMEOUT_MS: '0' });
  try {
    const target = {
      db,
      openStorage: () => openFileStorage(storage),
      say,
      onPhase: (next: MovePhase) => (phase = next),
    };
    return (await runMove(args, target)) ? 0 : 1;
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
