import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface Config {
  port: number;
  host: string;
  databaseUrl: string;
  uploadsDir: string;
  token: string | null;
  webDist: string;
  testReset: boolean;
  repoRoot: string;
  version: string;
}

// This file runs as src/config.ts (tsx, vitest) and bundled as dist/main.js:
// both sit one level below the server package root.
const SERVER_ROOT = fileURLToPath(new URL('..', import.meta.url));

export const REPO_ROOT = resolve(SERVER_ROOT, '../..');

export const DEFAULT_PORT = 4100;

function readVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(SERVER_ROOT, 'package.json'), 'utf8')) as {
      version?: unknown;
    };
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function parsePort(value: string | undefined): number {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : DEFAULT_PORT;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: parsePort(env.PORT),
    host: env.HOST || '127.0.0.1',
    databaseUrl: env.DATABASE_URL || join(REPO_ROOT, 'data', 'tracker.db'),
    uploadsDir: env.UPLOADS_DIR || join(REPO_ROOT, 'data', 'uploads'),
    token: env.TRACKER_TOKEN || null,
    webDist: env.WEB_DIST || join(REPO_ROOT, 'apps', 'web', 'dist'),
    testReset: env.TRACKER_TEST_RESET === '1',
    repoRoot: REPO_ROOT,
    version: readVersion(),
  };
}
