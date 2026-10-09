import { ALLOW_EXISTING_FLAG } from './plan';

export const MOVE_USAGE = `Usage: npm run data:move -- --from data/tracker.db --uploads data/uploads [--dry-run]

Copies a local tracker (its SQLite file and uploads folder) into the database in DATABASE_URL and
the files storage the server would use: S3_BUCKET with AWS_REGION and the AWS keys, or UPLOADS_DIR.
Neither falls back to data/, which is the source. The local file and folder are only read: the
command backs the file up to a temporary copy and migrates the copy.

  --from <file>       The local SQLite file.
  --uploads <dir>     Its uploads folder.
  --dry-run           Say what would be copied (rows per table, files, bytes, images compressed)
                      and change nothing.
  ${ALLOW_EXISTING_FLAG}    Copy even though the target already holds projects or tickets,
                      next to them.

Images are compressed as new uploads are, and only the compressed copy is stored. Rows are
written in one transaction after the files, then counted and every file is checked.
`;

export interface MoveArgs {
  from: string;
  uploads: string;
  dryRun: boolean;
  allowExisting: boolean;
}

export type ParsedMoveArgs = MoveArgs | { help: true } | { error: string };

const SWITCHES = new Set(['--dry-run', ALLOW_EXISTING_FLAG]);
const VALUED = new Set(['--from', '--uploads']);

// "--from x" or "--from=x". Anything unknown stops it: a misspelt --dry-run must not move data.
function readFlags(argv: readonly string[]): Map<string, string> | string {
  const flags = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const [name = '', inline] = (argv[index] ?? '').split(/=(.*)/s, 2);
    if (SWITCHES.has(name) && inline === undefined) {
      flags.set(name, '');
    } else if (VALUED.has(name)) {
      const value = inline ?? argv[index + 1];
      if (inline === undefined) index += 1;
      if (!value || value.startsWith('--')) return `${name} needs a path.`;
      flags.set(name, value);
    } else {
      return `Unknown option: ${argv[index]}.`;
    }
  }
  return flags;
}

export function parseMoveArgs(argv: readonly string[]): ParsedMoveArgs {
  if (argv.includes('--help') || argv.includes('-h')) return { help: true };
  const flags = readFlags(argv);
  if (typeof flags === 'string') return { error: flags };
  const from = flags.get('--from');
  const uploads = flags.get('--uploads');
  if (!from || !uploads)
    return { error: 'Give the local database with --from and its folder of files with --uploads.' };
  return {
    from,
    uploads,
    dryRun: flags.has('--dry-run'),
    allowExisting: flags.has(ALLOW_EXISTING_FLAG),
  };
}
