import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDiskStorage } from '../../src/storage/diskStorage';
import type { FileStorage } from '../../src/storage/fileStorage';
import { createMemoryStorage } from '../../src/storage/memoryStorage';
import { createS3Storage, S3_KEY_PREFIX } from '../../src/storage/s3Storage';
import { startFakeS3, type FakeS3 } from '../helpers/fakeS3';

const MB = 1024 * 1024;

// A repeating pattern that doesn't line up with 1 MB chunks or 5 MB parts, so bytes out of place
// show.
const PATTERN = Buffer.from(Array.from({ length: 251 }, (_, index) => index));
const BIG = Buffer.alloc(11 * MB, PATTERN);

interface StorageUnderTest {
  storage: FileStorage;
  // Everything kept: files, objects and unfinished multipart uploads.
  leftovers: () => string[];
  reset: () => void;
  close: () => Promise<void>;
}

// Sends `bytes` a megabyte at a time when asked, then ends or fails.
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

const textOf = async (stream: Promise<ReadableStream<Uint8Array> | null>) =>
  (await bufferOf(stream)).toString();

function memory(): StorageUnderTest {
  const storage = createMemoryStorage();
  return {
    storage,
    leftovers: () => [...storage.files.keys()],
    reset: () => storage.files.clear(),
    close: () => Promise.resolve(),
  };
}

function disk(): StorageUnderTest {
  const dir = mkdtempSync(join(tmpdir(), 'tracker-storage-'));
  const files = join(dir, 'nested');
  const leftovers = () => {
    try {
      return readdirSync(files);
    } catch {
      return [];
    }
  };
  return {
    storage: createDiskStorage(files),
    leftovers,
    reset: () => rmSync(files, { recursive: true, force: true }),
    close: () => Promise.resolve(rmSync(dir, { recursive: true, force: true })),
  };
}

async function s3(): Promise<StorageUnderTest> {
  const fake = await startFakeS3();
  return {
    storage: createS3Storage({ client: fake.client(), bucket: fake.bucket }),
    leftovers: () => [
      ...fake.objects.keys(),
      ...[...fake.uploads.keys()].map((id) => `upload ${id}`),
    ],
    reset: () => fake.reset(),
    close: () => fake.close(),
  };
}

const KINDS: [string, () => StorageUnderTest | Promise<StorageUnderTest>][] = [
  ['memory', memory],
  ['disk', disk],
  ['s3', s3],
];

describe.each(KINDS)('%s file storage', (kind, open) => {
  let subject: StorageUnderTest;
  const storage = () => subject.storage;
  const stored = () => subject.leftovers().map((key) => key.replace(S3_KEY_PREFIX, ''));

  beforeAll(async () => {
    subject = await open();
  });
  beforeEach(() => subject.reset());
  afterAll(() => subject.close());

  it('writes, streams, measures and removes a file', async () => {
    await storage().write('a.png', new Blob([new Uint8Array([1, 2, 3])]).stream());
    expect([...(await bufferOf(storage().read('a.png')))]).toEqual([1, 2, 3]);
    expect(await storage().stat('a.png')).toEqual({ size: 3 });
    expect(stored()).toEqual(['a.png']);

    await storage().remove('a.png');
    expect(await storage().read('a.png')).toBeNull();
    expect(await storage().stat('a.png')).toBeNull();
    await expect(storage().remove('a.png')).resolves.toBeUndefined();
    expect(stored()).toEqual([]);
  });

  it('reads only the asked bytes', async () => {
    await storage().write('b.txt', new Blob(['0123456789']).stream());
    expect(await textOf(storage().read('b.txt', { start: 2, end: 4 }))).toBe('234');
    expect(await textOf(storage().read('b.txt', { start: 9, end: 9 }))).toBe('9');
    expect(await textOf(storage().read('b.txt'))).toBe('0123456789');
    expect(await storage().read('missing.txt', { start: 0, end: 1 })).toBeNull();
    expect(await storage().stat('missing.txt')).toBeNull();
  });

  it('keeps an empty file', async () => {
    await storage().write('empty.txt', new Blob([]).stream());
    expect(await textOf(storage().read('empty.txt'))).toBe('');
    expect(await storage().stat('empty.txt')).toEqual({ size: 0 });
  });

  it('keeps a file bigger than an S3 part whole, and reads ranges across parts', async () => {
    await storage().write('big.mp4', streamOf(BIG));
    expect(stored()).toEqual(['big.mp4']);
    expect(await storage().stat('big.mp4')).toEqual({ size: BIG.byteLength });
    expect((await bufferOf(storage().read('big.mp4'))).equals(BIG)).toBe(true);
    const across = { start: 5 * MB - 3, end: 10 * MB + 2 };
    const part = await bufferOf(storage().read('big.mp4', across));
    expect(part.equals(BIG.subarray(across.start, across.end + 1))).toBe(true);
  });

  it('keeps nothing of a small file whose stream fails part way', async () => {
    const failing = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.error(new Error('The connection closed.'));
      },
    });
    await expect(storage().write('c.mp4', failing)).rejects.toThrow('The connection closed.');
    expect(await storage().read('c.mp4')).toBeNull();
    expect(stored()).toEqual([]);
  });

  it('keeps nothing of a big file whose stream fails after several parts', async () => {
    const failing = streamOf(BIG, new Error('The file is too big.'));
    await expect(storage().write('d.png', failing)).rejects.toThrow('The file is too big.');
    expect(await storage().stat('d.png')).toBeNull();
    expect(stored(), kind).toEqual([]);
  });

  it('refuses keys it did not make, which could reach outside its folder or prefix', async () => {
    for (const key of ['../evil', '.hidden', 'a/b.png', '']) {
      await expect(storage().write(key, new Blob([]).stream()), key).rejects.toThrow(
        'Invalid storage key',
      );
      await expect(storage().read(key), key).rejects.toThrow('Invalid storage key');
      await expect(storage().stat(key), key).rejects.toThrow('Invalid storage key');
      await expect(storage().remove(key), key).rejects.toThrow('Invalid storage key');
    }
    expect(stored()).toEqual([]);
  });
});

describe('S3 file storage', () => {
  let fake: FakeS3;
  let storage: FileStorage;
  const operations = () => fake.calls.map((call) => call.operation);

  beforeAll(async () => {
    fake = await startFakeS3();
    storage = createS3Storage({ client: fake.client(), bucket: fake.bucket });
  });
  beforeEach(() => fake.reset());
  afterAll(() => fake.close());

  it('keeps objects under attachments/ in the bucket', async () => {
    await storage.write('a.txt', new Blob(['hi']).stream());
    expect([...fake.objects.keys()]).toEqual(['attachments/a.txt']);
  });

  it('sends a file of up to one part in one PUT and a bigger one in 5 MB parts', async () => {
    await storage.write('small.txt', streamOf(BIG.subarray(0, 5 * MB)));
    expect(operations()).toEqual(['PutObject']);

    fake.calls.length = 0;
    await storage.write('big.mp4', streamOf(BIG));
    expect(operations().filter((operation) => operation === 'UploadPart')).toHaveLength(3);
    expect(operations().at(0)).toBe('CreateMultipartUpload');
    expect(operations().at(-1)).toBe('CompleteMultipartUpload');
    expect(fake.uploads.size).toBe(0);
  });

  it('aborts the multipart upload when the stream fails, leaving no parts', async () => {
    const failing = streamOf(BIG, new Error('The file did not arrive whole. Try again.'));
    await expect(storage.write('cut.mp4', failing)).rejects.toThrow('did not arrive whole');
    expect(operations()).toContain('UploadPart');
    expect(operations().at(-1)).toBe('AbortMultipartUpload');
    expect(fake.uploads.size).toBe(0);
    expect(fake.objects.size).toBe(0);
  });

  it('aborts the multipart upload when S3 refuses a part', async () => {
    fake.refused.add('UploadPart');
    await expect(storage.write('refused.mp4', streamOf(BIG))).rejects.toThrow();
    expect(operations().at(-1)).toBe('AbortMultipartUpload');
    expect(fake.uploads.size).toBe(0);
    expect(fake.objects.size).toBe(0);
  });

  it('asks S3 for just the range it reads', async () => {
    await storage.write('b.txt', new Blob(['0123456789']).stream());
    await textOf(storage.read('b.txt', { start: 2, end: 4 }));
    expect(fake.calls.at(-1)).toEqual({
      operation: 'GetObject',
      key: 'attachments/b.txt',
      range: 'bytes=2-4',
    });
  });

  it('measures a file with HEAD, without downloading it', async () => {
    await storage.write('b.txt', new Blob(['0123456789']).stream());
    expect(await storage.stat('b.txt')).toEqual({ size: 10 });
    expect(operations().at(-1)).toBe('HeadObject');
  });

  // Players drop range requests all the time; a dropped read that kept its connection would use
  // up the SDK's 50 and leave every later read waiting.
  it('frees the connection of a read stopped part way', async () => {
    await storage.write('big.mp4', streamOf(BIG));
    for (let index = 0; index < 60; index += 1) {
      const reader = (await storage.read('big.mp4'))!.getReader();
      await reader.read();
      await reader.cancel();
    }
    expect(await textOf(storage.read('big.mp4', { start: 0, end: 2 }))).toBe('\x00\x01\x02');
  });

  it('fails a read S3 refuses instead of calling the file missing', async () => {
    await storage.write('b.txt', new Blob(['0123456789']).stream());
    fake.refused.add('GetObject');
    fake.refused.add('HeadObject');
    await expect(storage.read('b.txt')).rejects.toThrow();
    await expect(storage.stat('b.txt')).rejects.toThrow();
  });
});
