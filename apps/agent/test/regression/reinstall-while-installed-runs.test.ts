import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { requireFreeFolder } from '../../src/watch/autostart/rules';
import { FolderBusyError, lockFolder } from '../../src/watch/folderLock';

// Reviewer 143: --install again, to change --name, was refused while the installed helper ran,
// since that helper holds the folder's lock, and the message said to delete the lock.
describe('regression: installing again while the installed helper runs', () => {
  const locks = mkdtempSync(join(tmpdir(), 'reinstall-locks-'));
  afterEach(() => rmSync(locks, { recursive: true, force: true }));

  it('goes ahead when the installed helper holds the folder', () => {
    const release = lockFolder(locks, '/code/mobile');
    expect(() => requireFreeFolder(locks, '/code/mobile', () => process.pid)).not.toThrow();
    release();
  });

  it('still refuses another helper, and says how to stop an installed one', () => {
    const release = lockFolder(locks, '/code/mobile');
    expect(() => requireFreeFolder(locks, '/code/mobile', () => undefined)).toThrow(
      FolderBusyError,
    );
    expect(() => requireFreeFolder(locks, '/code/mobile', () => process.pid + 1)).toThrow(
      'run "tracker watch --uninstall" if it was installed',
    );
    release();
  });

  it('asks launchd only when the folder is taken', () => {
    let asked = false;
    requireFreeFolder(locks, '/code/web', () => {
      asked = true;
      return undefined;
    });
    expect(asked).toBe(false);
  });
});
