import { mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { openFileStorage } from '../../src/storage/openFileStorage';

const filesIn = (dir: string): string[] =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));

async function untilWritten(dir: string, bytes: number): Promise<void> {
  while (!filesIn(dir).some((file) => statSync(file).size >= bytes)) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

// A stop cuts an upload still arriving after the 10 s grace, and the process exits before the
// handler removes what was written: the partial file stayed in UPLOADS_DIR under its own name, with
// no row, for good (192258 of 266669 bytes in the review).
describe('a disk upload cut off by a stop', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tracker-cut-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('never sits under its own name, and is gone when the server starts again', async () => {
    const storage = await openFileStorage({ s3: null, uploadsDir: dir });
    await storage.write('kept.txt', new Blob(['whole']).stream());
    let arriving!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({ start: (controller) => (arriving = controller) });
    const writing = storage.write('cut.mp4', body);
    arriving.enqueue(new Uint8Array(64 * 1024));
    await untilWritten(dir, 64 * 1024);

    expect(await storage.stat('cut.mp4')).toBeNull();

    // The process is gone at this point; the next one opens the same folder.
    await openFileStorage({ s3: null, uploadsDir: dir });
    expect(filesIn(dir)).toEqual([join(dir, 'kept.txt')]);

    arriving.error(new Error('cut off'));
    await expect(writing).rejects.toThrow('cut off');
    expect(filesIn(dir)).toEqual([join(dir, 'kept.txt')]);
  });
});
