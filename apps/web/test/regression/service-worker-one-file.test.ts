import { execFile } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, expect, it } from 'vitest';
import { SKIP_PRECOMPRESS } from '../../src/build/precompress';

const WEB_ROOT = resolve(fileURLToPath(import.meta.url), '../../..');
const VITE = join(createRequire(import.meta.url).resolve('vite/package.json'), '../bin/vite.js');
const BUILD_TIMEOUT_MS = 100_000;
// Past the build's own limit, so a hung build fails with the build's error, not the test's.
const TEST_TIMEOUT_MS = BUILD_TIMEOUT_MS + 20_000;

let outDir = '';

afterEach(() => {
  if (outDir) rmSync(outDir, { recursive: true, force: true });
});

// A real build, in a process of its own: the PWA plugin can't write sw.js under jsdom's URL.
// The child is killed at its own limit and when the test times out or the run is cancelled, with
// SIGKILL, which a hung process can't ignore; else it kept running after the test (PT-102).
async function buildWebApp(signal: AbortSignal): Promise<string> {
  outDir = mkdtempSync(join(tmpdir(), 'tracker-sw-'));
  await promisify(execFile)(
    process.execPath,
    [VITE, 'build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'error'],
    {
      cwd: WEB_ROOT,
      env: { ...process.env, NODE_ENV: 'production', [SKIP_PRECOMPRESS]: '1' },
      timeout: BUILD_TIMEOUT_MS,
      killSignal: 'SIGKILL',
      signal,
    },
  );
  return outDir;
}

// sw.js loaded the Workbox runtime from a file of its own, and Workbox's loader swallows a failed
// importScripts, so a deploy without that file installed a worker with no handlers that later
// checks never replaced, and offline stopped working once it took over (PT-99). The server
// revalidates every file outside /assets/, so a lone sw.js is all it has to get right.
it(
  'builds a service worker that loads no other script',
  async ({ signal }) => {
    const dist = await buildWebApp(signal);

    expect(readdirSync(dist).filter((name) => name.endsWith('.js'))).toEqual(['sw.js']);
    expect(readFileSync(join(dist, 'sw.js'), 'utf8')).not.toContain('importScripts');
  },
  TEST_TIMEOUT_MS,
);
