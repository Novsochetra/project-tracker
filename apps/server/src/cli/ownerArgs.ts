export const OWNER_USAGE = `Usage: npm run owner:set -- --email you@example.com

Sets the one account that signs in to the tracker. Type the password when asked (twice, hidden),
or pipe it in: the first line of standard input is the password. It never goes in env vars or
command lines, and the database keeps only a scrypt hash of it.

Uses the database the server uses: DATABASE_URL (Postgres) or the local SQLite file. A local
SQLite file is migrated first; a Postgres database must already be migrated (db:migrate). Running
it again replaces the email and password and signs out every device; API tokens keep working.
`;

export type OwnerArgs = { email: string } | { help: true } | { error: string };

export function parseOwnerArgs(argv: readonly string[]): OwnerArgs {
  if (argv.includes('--help') || argv.includes('-h')) return { help: true };
  const inline = argv.find((arg) => arg.startsWith('--email='));
  const index = argv.indexOf('--email');
  const email = inline ? inline.slice('--email='.length) : index >= 0 ? argv[index + 1] : undefined;
  if (!email || email.startsWith('--')) return { error: 'Give the owner’s email with --email.' };
  if (argv.some((arg) => arg.startsWith('--password'))) {
    return { error: 'Type the password when asked, or pipe it in; never pass it as an argument.' };
  }
  return { email };
}

// A pipe hands over everything at once; only the first line is the password.
export const firstLine = (text: string): string => text.split(/\r?\n/)[0] ?? '';
