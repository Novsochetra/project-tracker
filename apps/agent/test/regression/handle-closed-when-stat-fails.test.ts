import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import type * as FsPromises from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { checkLocalFile } from '../../src/files/localFile';

const opened = vi.hoisted(() => ({ closed: 0 }));

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof FsPromises>();
  return {
    ...actual,
    open: async (...args: Parameters<typeof actual.open>) => {
      const handle = await actual.open(...args);
      return {
        stat: () => Promise.reject(new Error('EIO: i/o error, fstat')),
        close: async () => {
          opened.closed += 1;
          await handle.close();
        },
      };
    },
  };
});

const work = realpathSync(mkdtempSync(join(tmpdir(), 'attach-stat-')));
writeFileSync(join(work, 'notes.md'), '# Notes');

afterAll(() => rmSync(work, { recursive: true, force: true }));

// openChecked awaited the handle's stat with no catch, so a failing stat left the file open.
describe('a file whose opened handle cannot be read for its size', () => {
  it('closes the handle and passes the error on', async () => {
    await expect(checkLocalFile(join(work, 'notes.md'), [work])).rejects.toThrow('EIO');
    expect(opened.closed).toBe(1);
  });
});
