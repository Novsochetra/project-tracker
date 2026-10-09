import { setOwner, type SetOwnerResult } from '../auth/owner';
import { loadConfig } from '../config';
import { createDatabase } from '../db/createDatabase';
import { prepareDatabase } from '../db/startup';
import { OWNER_USAGE, parseOwnerArgs } from './ownerArgs';
import { readPassword } from './readPassword';

const say = (text: string) => process.stdout.write(`${text}\n`);

function summary({ email, created, signedOut }: SetOwnerResult): string {
  if (created) return `Owner account created for ${email}. Sign in to the tracker with it.`;
  const devices = signedOut === 1 ? '1 device' : `${signedOut} devices`;
  return `Owner account updated to ${email}. Signed out ${devices}; API tokens still work.`;
}

async function run(): Promise<number> {
  const args = parseOwnerArgs(process.argv.slice(2));
  if ('help' in args) {
    say(OWNER_USAGE);
    return 0;
  }
  if ('error' in args) {
    console.error(`${args.error}\n\n${OWNER_USAGE}`);
    return 1;
  }
  const password = await readPassword();
  const { databaseUrl } = loadConfig();
  const db = createDatabase(databaseUrl);
  try {
    // Like the server: a local SQLite file is migrated, a Postgres database must already match
    // this build, so a laptop checkout never applies its unreleased migrations to production.
    await prepareDatabase(db, databaseUrl);
    say(summary(await setOwner(db, { email: args.email, password }, Date.now())));
    return 0;
  } finally {
    await db.destroy();
  }
}

run().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
