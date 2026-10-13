import { mkdirSync, mkdtempSync, realpathSync, rmSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { UNSUPPORTED_ATTACHMENT_MESSAGE } from '@tracker/shared';
import { afterAll, describe, expect, it } from 'vitest';
import { checkLocalFile, readLocalFile } from '../../src/files/localFile';

const work = realpathSync(mkdtempSync(join(tmpdir(), 'attach-file-')));
mkdirSync(join(work, 'folder.md'));
writeFileSync(join(work, 'data.csv'), 'a,b\n1,2\n');
writeFileSync(join(work, 'page.html'), '<script></script>');
writeFileSync(join(work, 'huge.md'), '');
truncateSync(join(work, 'huge.md'), 5 * 1024 * 1024 + 1);

afterAll(() => rmSync(work, { recursive: true, force: true }));

describe('checkLocalFile', () => {
  it('gives the type from the name, and reads the file with it', async () => {
    const file = await checkLocalFile(join(work, 'data.csv'), [work]);
    expect(file).toEqual({
      realPath: join(work, 'data.csv'),
      name: 'data.csv',
      mimeType: 'text/csv',
      size: 8,
    });
    const blob = await readLocalFile(file);
    expect(blob.type).toBe('text/csv');
    expect(await blob.text()).toBe('a,b\n1,2\n');
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
