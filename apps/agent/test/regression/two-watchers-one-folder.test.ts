import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FolderBusyError, lockFolder } from '../../src/watch/folderLock';

// Reviewer 140: two tracker watch in one folder shared an id, so each one's ask for a run ended
// the other's run as "restarted" while its Claude kept working, and two Claudes ran in one tree.
describe('regression: one tracker watch per folder', () => {
  const locks = mkdtempSync(join(tmpdir(), 'watch-locks-'));
  afterEach(() => rmSync(locks, { recursive: true, force: true }));

  it('refuses a second helper in the same folder until the first one stops', () => {
    const release = lockFolder(locks, '/code/mobile');
    expect(() => lockFolder(locks, '/code/mobile')).toThrow(FolderBusyError);
    expect(() => lockFolder(locks, '/code/mobile')).toThrow(
      `tracker watch already runs in this folder (process ${process.pid}).`,
    );
    const other = lockFolder(locks, '/code/web');
    release();
    lockFolder(locks, '/code/mobile')();
    other();
  });

  it('takes over the lock of a helper that died without letting go', () => {
    lockFolder(locks, '/code/mobile');
    const [file] = readdirSync(locks);
    writeFileSync(join(locks, file!), '99999999');
    expect(() => lockFolder(locks, '/code/mobile')()).not.toThrow();
  });
});
