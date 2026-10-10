import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startFakeS3, type FakeS3 } from '../helpers/fakeS3';

const SERVER_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

async function until(condition: () => boolean, what: string): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

// Reviewer 102 (PT-133): at start the server removed every object under attachments/ that its own
// database didn't name, once an hour old. A server on another database with the same bucket then
// deleted the online tracker's files: run locally against the bucket as docs/s3-storage.md said
// (local SQLite), a Railway environment copied from production with its own Postgres, or a
// database restored from a backup. A server now deletes only what its own database deleted.
describe('a server started on a bucket another database uses', () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'tracker-other-db-'));
  let fake: FakeS3;
  let child: ChildProcess | undefined;

  beforeAll(async () => {
    fake = await startFakeS3();
  });

  afterAll(async () => {
    child?.kill();
    await fake.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  it('leaves the files of attachments its database never had', async () => {
    for (const id of [
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ]) {
      fake.objects.set(`attachments/${id}.webp`, Buffer.from('a photo the online tracker has'));
      fake.modified.set(`attachments/${id}.webp`, Date.now() - TWO_HOURS_MS);
    }
    const args = [
      '--import',
      'tsx',
      '--import',
      './test/helpers/listenOnAnyPort.ts',
      'src/main.ts',
    ];
    child = spawn(process.execPath, args, {
      cwd: SERVER_ROOT,
      env: {
        ...process.env,
        HOST: '127.0.0.1',
        DATABASE_URL: join(dataDir, 'tracker.db'),
        UPLOADS_DIR: join(dataDir, 'uploads'),
        WEB_DIST: join(dataDir, 'no-web'),
        S3_BUCKET: fake.bucket,
        S3_ENDPOINT: fake.endpoint,
        AWS_REGION: 'us-east-1',
        AWS_ACCESS_KEY_ID: 'fake-s3-key',
        AWS_SECRET_ACCESS_KEY: 'fake-s3-secret',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout?.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.stderr?.on('data', (chunk: Buffer) => (output += chunk.toString()));
    await until(() => output.includes('Tracker API on'), `the server to start:\n${output}`);
    // Whatever the start does in the background has had time to reach S3.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    let seen = -1;
    await until(() => {
      const quiet = fake.calls.length === seen;
      seen = fake.calls.length;
      return quiet;
    }, 'S3 to go quiet');
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(fake.calls.map((call) => call.operation)).not.toContain('DeleteObject');
    expect(fake.objects.size).toBe(2);
  });
});
