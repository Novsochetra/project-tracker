import { mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { UNSUPPORTED_ATTACHMENT_MESSAGE } from '@tracker/shared';
import { afterAll, describe, expect, it } from 'vitest';
import { checkLocalFile, closeLocalFiles } from '../../src/files/localFile';

// The type came from the asked name, so x.txt linking to ~/.aws/credentials went as text/plain.
const work = realpathSync(mkdtempSync(join(tmpdir(), 'attach-link-type-')));
writeFileSync(join(work, 'credentials'), 'secret');
writeFileSync(join(work, 'data.csv'), 'a,b\n');
symlinkSync(join(work, 'credentials'), join(work, 'x.txt'));
symlinkSync(join(work, 'data.csv'), join(work, 'data.txt'));

afterAll(() => rmSync(work, { recursive: true, force: true }));

describe('a symlink whose name has another type than its file', () => {
  it('refuses a file with no type behind a .txt name', async () => {
    await expect(checkLocalFile(join(work, 'x.txt'), [work])).rejects.toThrow(
      `Can't attach credentials. ${UNSUPPORTED_ATTACHMENT_MESSAGE}`,
    );
  });

  it("takes the type and the name from the real file's name", async () => {
    const file = await checkLocalFile(join(work, 'data.txt'), [work]);
    expect(file).toMatchObject({ name: 'data.csv', mimeType: 'text/csv' });
    await closeLocalFiles([file]);
  });
});
