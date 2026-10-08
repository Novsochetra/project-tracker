import { describe, expect, it } from 'vitest';
import { fileUpload } from '../helpers/fixtures';
import { DIALECTS, useTestServer } from '../helpers/server';

// X-File-Name is percent-decoded, and control characters stayed in the name: `a%00b.txt` was a
// 500 on Postgres, which refuses a NUL in text, and SQLite stored the NUL and line breaks.
describe.each(DIALECTS)('control characters in file names (%s)', (dialect) => {
  const api = useTestServer(dialect);

  async function uploadNamed(name: string) {
    const res = await api.upload(fileUpload({ name }));
    const row = await api.db.selectFrom('attachments').select('fileName').executeTakeFirst();
    return { status: res.status, fileName: res.body.fileName, stored: row?.fileName };
  }

  const kept = (fileName: string) => ({ status: 201, fileName, stored: fileName });

  it('drops a NUL', async () => {
    expect(await uploadNamed('a\u0000b.txt')).toEqual(kept('ab.txt'));
  });

  it('drops the other control characters and DEL', async () => {
    expect(await uploadNamed('\u001b[1mbold\u0007\u007f\u009b.txt')).toEqual(kept('[1mbold.txt'));
  });

  it('turns tabs and line breaks into one space', async () => {
    expect(await uploadNamed('Q3\r\nreport\tfinal\n.txt')).toEqual(kept('Q3 report final .txt'));
  });

  it('names a file that has only control characters after its type', async () => {
    expect(await uploadNamed('\u0000\r\n\u007f')).toEqual(kept('attachment.txt'));
  });

  it('cuts to 200 characters after dropping them', async () => {
    const name = `${'\u0000'.repeat(5)}${'a'.repeat(199)}📄.txt`;
    expect(await uploadNamed(name)).toEqual(kept(`${'a'.repeat(199)}📄`));
  });
});
