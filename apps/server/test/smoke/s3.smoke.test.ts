import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REPO_ROOT, loadConfig } from '../../src/config';
import type { FileStorage } from '../../src/storage/fileStorage';
import { openFileStorage } from '../../src/storage/openFileStorage';

// Talks to the real bucket, so it runs only when asked: `npm run test:s3 -w @tracker/server`
// (docs/s3-storage.md). npm run verify skips it.
const ENABLED = process.env.TRACKER_S3_SMOKE === '1';
const ENV_FILE = join(REPO_ROOT, '.env');

const MB = 1024 * 1024;
const PATTERN = Buffer.from(Array.from({ length: 251 }, (_, index) => index));
const BIG = Buffer.alloc(11 * MB, PATTERN);

function streamOf(bytes: Uint8Array, failure?: Error): ReadableStream<Uint8Array> {
  let sent = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent < bytes.byteLength) {
        controller.enqueue(bytes.slice(sent, sent + MB));
        sent += MB;
      } else if (failure) controller.error(failure);
      else controller.close();
    },
  });
}

const bufferOf = async (stream: Promise<ReadableStream<Uint8Array> | null>) =>
  Buffer.from(await new Response(await stream).arrayBuffer());

describe.skipIf(!ENABLED)('the real S3 bucket', () => {
  let storage: FileStorage;
  const keys: string[] = [];
  const keyFor = (extension: string) => {
    const key = `smoke-${randomUUID()}.${extension}`;
    keys.push(key);
    return key;
  };

  async function isGone(key: string): Promise<boolean> {
    try {
      return (await storage.stat(key)) === null;
    } catch (error) {
      throw new Error(
        `S3 would not say whether ${key} is there (${(error as Error).name}). Without s3:ListBucket ` +
          'on the bucket, S3 answers 403 for a missing file and the tracker 500 instead of 404.',
      );
    }
  }

  beforeAll(async () => {
    // The keys stay in the gitignored .env instead of the shell's history.
    if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
    const config = loadConfig();
    if (!config.s3) {
      throw new Error('Set S3_BUCKET, AWS_REGION and the AWS keys (see .env.example).');
    }
    storage = await openFileStorage(config);
  });

  afterAll(async () => {
    await Promise.allSettled(keys.map((key) => storage?.remove(key)));
  });

  it('keeps, reads, measures and removes a small file', async () => {
    const key = keyFor('txt');
    await storage.write(key, new Blob(['0123456789']).stream());
    expect((await bufferOf(storage.read(key))).toString()).toBe('0123456789');
    expect((await bufferOf(storage.read(key, { start: 2, end: 4 }))).toString()).toBe('234');
    expect(await storage.stat(key)).toEqual({ size: 10 });
    await storage.remove(key);
    expect(await isGone(key)).toBe(true);
  });

  it('uploads a big file in parts and reads a range across them', async () => {
    const key = keyFor('mp4');
    await storage.write(key, streamOf(BIG));
    expect(await storage.stat(key)).toEqual({ size: BIG.byteLength });
    const range = { start: 5 * MB - 3, end: 5 * MB + 3 };
    const part = await bufferOf(storage.read(key, range));
    expect(part.equals(BIG.subarray(range.start, range.end + 1))).toBe(true);
  });

  it('keeps nothing of a big file whose stream fails', async () => {
    const key = keyFor('mp4');
    const failing = streamOf(BIG, new Error('The file did not arrive whole.'));
    await expect(storage.write(key, failing)).rejects.toThrow('did not arrive whole');
    expect(await isGone(key)).toBe(true);
  });
});
