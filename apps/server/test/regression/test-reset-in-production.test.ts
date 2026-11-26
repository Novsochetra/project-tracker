import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config';

const SERVER_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const PASSWORD = 'Sup3rSecretPW';
const AWS_SECRET = 'aws-s3cret-key-value';
const RAILWAY = {
  RAILWAY_ENVIRONMENT_ID: 'env-1',
  DATABASE_URL: `postgresql://postgres:${PASSWORD}@postgres.railway.internal:5432/railway`,
  S3_BUCKET: 'tracker-files',
  AWS_REGION: 'eu-west-1',
  AWS_ACCESS_KEY_ID: 'AKIAEXAMPLEKEY',
  AWS_SECRET_ACCESS_KEY: AWS_SECRET,
};

const startError = (env: NodeJS.ProcessEnv): string => {
  try {
    loadConfig(env);
    return '';
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

interface Exit {
  code: number | null;
  output: string;
}

// A server that starts after all is stopped once it listens, so the test fails instead of hanging.
function startServer(env: NodeJS.ProcessEnv): { child: ChildProcess; exit: Promise<Exit> } {
  const args = ['--import', 'tsx', '--import', './test/helpers/listenOnAnyPort.ts', 'src/main.ts'];
  const child = spawn(process.execPath, args, {
    cwd: SERVER_ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  const collect = (chunk: Buffer) => {
    output += chunk.toString();
    if (output.includes('Tracker API on')) child.kill();
  };

  child.stdout.on('data', collect);
  child.stderr.on('data', collect);
  const exit = new Promise<Exit>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, output }));
  });

  return { child, exit };
}

// TRACKER_TEST_RESET=1 adds POST /api/test/reset, which any signed-in person or agent token can
// call to delete every account's rows and files. It is meant for E2E only, but nothing kept it off
// a server people use: one wrong variable on Railway would have let anyone wipe the tracker.
describe('the test reset route on a production server', () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'tracker-test-reset-'));
  let child: ChildProcess | undefined;

  afterAll(() => {
    child?.kill();
    rmSync(dataDir, { recursive: true, force: true });
  });

  it('stops the start with NODE_ENV=production and says why', () => {
    const message = startError({ NODE_ENV: 'production', TRACKER_TEST_RESET: '1' });
    expect(message).toMatch(/^TRACKER_TEST_RESET=1 /);
    expect(message).toMatch(/NODE_ENV is production/);
    expect(message).toMatch(/delete every account's/);
  });

  // Railpack's image sets NODE_ENV=production, but a service variable replaces it.
  it('stops the start on Railway whatever NODE_ENV says, without showing a secret', () => {
    for (const nodeEnv of [undefined, '', 'development', 'production']) {
      const message = startError({ ...RAILWAY, NODE_ENV: nodeEnv, TRACKER_TEST_RESET: '1' });
      expect(message, nodeEnv).toMatch(/^TRACKER_TEST_RESET=1 .*on Railway/);
      expect(message, nodeEnv).not.toContain(PASSWORD);
      expect(message, nodeEnv).not.toContain(AWS_SECRET);
    }

    expect(startError(RAILWAY)).toBe('');
  });

  it('keeps the route where E2E runs, and leaves production without it', () => {
    expect(loadConfig({ TRACKER_TEST_RESET: '1' }).testReset).toBe(true);
    expect(loadConfig({ NODE_ENV: 'test', TRACKER_TEST_RESET: '1' }).testReset).toBe(true);
    expect(loadConfig({ NODE_ENV: 'production' }).testReset).toBe(false);
    expect(loadConfig({ NODE_ENV: 'production', TRACKER_TEST_RESET: '0' }).testReset).toBe(false);
  });

  it('makes main.ts exit before it opens the database', { timeout: 120_000 }, async () => {
    const database = join(dataDir, 'tracker.db');
    const server = startServer({
      ...process.env,
      NODE_ENV: 'production',
      TRACKER_TEST_RESET: '1',
      HOST: '127.0.0.1',
      DATABASE_URL: database,
      UPLOADS_DIR: join(dataDir, 'uploads'),
      WEB_DIST: join(dataDir, 'no-web'),
      S3_BUCKET: '',
      S3_ENDPOINT: '',
    });
    child = server.child;
    const exit = await server.exit;

    expect(exit.output).toContain('TRACKER_TEST_RESET=1 ');
    expect(exit.output).not.toContain('Tracker API on');
    expect(exit.code).toBe(1);
    expect(existsSync(database)).toBe(false);
  });
});
