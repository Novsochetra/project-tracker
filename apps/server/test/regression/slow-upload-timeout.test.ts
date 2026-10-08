import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_ATTACHMENT_BYTES } from '@tracker/shared';
import { afterAll, expect, it } from 'vitest';

interface Timeouts {
  requestTimeout: number;
  headersTimeout: number;
}

const SERVER_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const dataDir = mkdtempSync(join(tmpdir(), 'tracker-timeouts-'));

afterAll(() => rmSync(dataDir, { recursive: true, force: true }));

function timeoutsOfStartedServer(): Promise<Timeouts> {
  const args = ['--import', 'tsx', '--import', './test/helpers/reportServerTimeouts.ts'];
  const child = spawn(process.execPath, [...args, 'src/main.ts'], {
    cwd: SERVER_ROOT,
    env: {
      ...process.env,
      DATABASE_URL: join(dataDir, 'tracker.db'),
      UPLOADS_DIR: join(dataDir, 'uploads'),
      WEB_DIST: join(dataDir, 'no-web'),
    },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  let output = '';
  child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
  return new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', () => {
      const line = output.split('\n').find((text) => text.startsWith('{'));
      if (line) resolve(JSON.parse(line) as Timeouts);
      else reject(new Error(`main.ts reported no timeouts:\n${output}`));
    });
  });
}

// Node answers 408 to a request still arriving after its requestTimeout, five minutes unless
// main.ts sets one, so a 100 MB video sent over a phone uplink under 2.8 Mbit/s never arrived.
it('lets the largest file arrive over a 256 kbit/s uplink and keeps the minute for headers', async () => {
  const { requestTimeout, headersTimeout } = await timeoutsOfStartedServer();
  const bytesPerMs = 256_000 / 8 / 1000;
  expect(requestTimeout).toBeGreaterThanOrEqual(MAX_ATTACHMENT_BYTES / bytesPerMs);
  expect(headersTimeout).toBe(60_000);
});
