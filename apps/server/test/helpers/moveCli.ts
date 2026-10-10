import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT } from '../../src/config';

const TSX_LOADER = pathToFileURL(join(REPO_ROOT, 'node_modules', 'tsx', 'dist', 'loader.mjs')).href;
const MOVE_CLI = join(REPO_ROOT, 'apps', 'server', 'src', 'cli', 'moveData.ts');

// S3 settings that never reach AWS: the endpoint is a closed port on this machine.
export const OFFLINE_S3_ENV = {
  S3_BUCKET: 'tracker-files',
  AWS_REGION: 'eu-west-1',
  AWS_ACCESS_KEY_ID: 'test-key',
  AWS_SECRET_ACCESS_KEY: 'test-secret',
  S3_ENDPOINT: 'http://127.0.0.1:9',
};

// A Postgres address where nothing listens.
export const CLOSED_POSTGRES_URL = 'postgres://mover:s3cret-pw@127.0.0.1:9/railway';

const TARGET_VARIABLES = /^(DATABASE_|S3_|AWS_|UPLOADS_DIR$|PGSSLMODE$|MIGRATE_ON_START$)/;

// Only the target the test names: nothing from the shell running the tests can point the command
// at a real database or bucket.
const testEnv = (env: Record<string, string>): NodeJS.ProcessEnv => ({
  ...Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !TARGET_VARIABLES.test(name)),
  ),
  ...env,
});

export interface CliResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}

export interface CliRun {
  child: ChildProcess;
  // What it has printed so far.
  stdout: () => string;
  done: Promise<CliResult>;
}

// node with tsx's loader rather than npx tsx: one process, so a signal reaches the command itself.
export function startMoveCli(
  args: readonly string[],
  env: Record<string, string>,
  cwd = REPO_ROOT,
): CliRun {
  const child = spawn(process.execPath, ['--import', TSX_LOADER, MOVE_CLI, ...args], {
    cwd,
    env: testEnv(env),
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
  child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
  const done = new Promise<CliResult>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
  return { child, stdout: () => stdout, done };
}

export const runMoveCli = (
  args: readonly string[],
  env: Record<string, string>,
  cwd?: string,
): Promise<CliResult> => startMoveCli(args, env, cwd).done;
