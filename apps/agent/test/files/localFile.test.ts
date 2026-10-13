import { execFileSync } from 'node:child_process';
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  truncateSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { UNSUPPORTED_ATTACHMENT_MESSAGE } from '@tracker/shared';
import { afterAll, describe, expect, it } from 'vitest';
import { checkLocalFile, closeLocalFiles, readLocalFile } from '../../src/files/localFile';

const work = realpathSync(mkdtempSync(join(tmpdir(), 'attach-file-')));
mkdirSync(join(work, 'folder.md'));
writeFileSync(join(work, 'data.csv'), 'a,b\n1,2\n');
writeFileSync(join(work, 'page.html'), '<script></script>');
writeFileSync(join(work, 'huge.md'), '');
truncateSync(join(work, 'huge.md'), 5 * 1024 * 1024 + 1);
const secret = join(mkdtempSync(join(tmpdir(), 'attach-secret-')), 'secret.md');
writeFileSync(secret, 'secret');

afterAll(() => {
  rmSync(work, { recursive: true, force: true });
  rmSync(secret, { force: true });
});

describe('checkLocalFile', () => {
  it('gives the type from the name, and reads the file with it', async () => {
    const file = await checkLocalFile(join(work, 'data.csv'), [work]);
    expect(file).toMatchObject({
      realPath: join(work, 'data.csv'),
      name: 'data.csv',
      mimeType: 'text/csv',
      size: 8,
    });
    const blob = await readLocalFile(file);
    expect(blob.type).toBe('text/csv');
    expect(await blob.text()).toBe('a,b\n1,2\n');
    await closeLocalFiles([file]);
  });

  it('reads the checked file even when a symlink took its place since', async () => {
    const path = join(work, 'swapped.md');
    writeFileSync(path, 'mine');
    const file = await checkLocalFile(path, [work]);
    unlinkSync(path);
    symlinkSync(secret, path);
    expect(await (await readLocalFile(file)).text()).toBe('mine');
    await closeLocalFiles([file]);
  });

  it('reads only the bytes it checked when the file grew since', async () => {
    const path = join(work, 'growing.md');
    writeFileSync(path, 'start');
    const file = await checkLocalFile(path, [work]);
    appendFileSync(path, ' and more');
    expect(await (await readLocalFile(file)).text()).toBe('start');
    await closeLocalFiles([file]);
  });

  it('refuses a named pipe without waiting for a writer', async () => {
    const pipe = join(work, 'pipe.md');
    execFileSync('mkfifo', [pipe]);
    await expect(checkLocalFile(pipe, [work])).rejects.toThrow(
      `Can't attach ${pipe}: it is not a file.`,
    );
  });

  it('refuses what the tracker would refuse, with its reason', async () => {
    await expect(checkLocalFile(join(work, 'page.html'), [work])).rejects.toThrow(
      `Can't attach page.html. ${UNSUPPORTED_ATTACHMENT_MESSAGE}`,
    );
    await expect(checkLocalFile(join(work, 'huge.md'), [work])).rejects.toThrow(
      "Can't attach huge.md. Text files can be up to 5 MB.",
    );
  });

  it('refuses a folder', async () => {
    const folder = join(work, 'folder.md');
    await expect(checkLocalFile(folder, [work])).rejects.toThrow(
      `Can't attach ${folder}: it is not a file.`,
    );
  });
});
