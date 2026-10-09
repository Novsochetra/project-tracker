import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAuthConfig, type AuthConfig } from './authConfig';
import { withRailwayDefaults } from './railway';
import { loadS3Config, type S3Config } from './storage/s3Config';

export interface Config {
  port: number;
  host: string;
  databaseUrl: string;
  uploadsDir: string;
  s3: S3Config | null;
  auth: AuthConfig;
  webDist: string;
  testReset: boolean;
  repoRoot: string;
  version: string;
  publicUrl: string | null;
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

function parsePublicUrl(value: string | undefined): string | null {
  const text = value?.trim() ?? '';
  if (!URL.canParse(text)) return null;
  const url = new URL(text);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
}

export const databaseUrlOf = (env: NodeJS.ProcessEnv): string =>
  env.DATABASE_URL || join(REPO_ROOT, 'data', 'tracker.db');

export function loadConfig(given: NodeJS.ProcessEnv = process.env): Config {
  const env = withRailwayDefaults(given);
  const host = env.HOST || '127.0.0.1';
  return {
    port: parsePort(env.PORT),
    host,
    databaseUrl: databaseUrlOf(env),
    uploadsDir: env.UPLOADS_DIR || join(REPO_ROOT, 'data', 'uploads'),
    s3: loadS3Config(env),
    webDist: env.WEB_DIST || join(REPO_ROOT, 'apps', 'web', 'dist'),
    testReset: env.TRACKER_TEST_RESET === '1',
    repoRoot: REPO_ROOT,
    version: readVersion(),
    publicUrl: parsePublicUrl(env.PUBLIC_URL),
    auth: loadAuthConfig(env, host),
  };
}
