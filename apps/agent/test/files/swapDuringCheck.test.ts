import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type * as AllowedPath from '../../src/files/allowedPath';
import { checkLocalFile } from '../../src/files/localFile';

// The swap happens right after the path check passes, the moment a racing process would use.
const swap = vi.hoisted(() => ({ run: (): void => undefined }));

vi.mock('../../src/files/allowedPath', async (importOriginal) => {
  const actual = await importOriginal<typeof AllowedPath>();
  return {
    ...actual,
    allowedRealPath: async (...args: Parameters<typeof actual.allowedRealPath>) => {
      const real = await actual.allowedRealPath(...args);
      swap.run();
      return real;
    },
  };
});

const root = realpathSync(mkdtempSync(join(tmpdir(), 'attach-swap-')));
const work = join(root, 'work');
const secrets = join(root, 'secrets');
mkdirSync(join(work, 'out'), { recursive: true });
mkdirSync(secrets);
writeFileSync(join(secrets, 'notes.md'), 'secret');

afterAll(() => rmSync(root, { recursive: true, force: true }));

const changed = (path: string) => `Can't attach ${path}: it changed while it was being checked.`;

describe('a file swapped between the check and the open', () => {
  it('refuses a symlink put in place of the file', async () => {
    const path = join(work, 'out', 'file.md');
    writeFileSync(path, 'mine');
    swap.run = () => {
      unlinkSync(path);
      symlinkSync(join(secrets, 'notes.md'), path);
    };
    await expect(checkLocalFile(path, [work])).rejects.toThrow(changed(path));
  });

  it('refuses a folder on its path swapped for a symlink', async () => {
    const path = join(work, 'out', 'notes.md');
    writeFileSync(path, 'mine');
    swap.run = () => {
      renameSync(join(work, 'out'), join(work, 'old'));
      symlinkSync(secrets, join(work, 'out'));
    };
    await expect(checkLocalFile(path, [work])).rejects.toThrow(changed(path));
  });
});
