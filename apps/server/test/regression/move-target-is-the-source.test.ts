import { symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sha256, sourceMigrations, writeMoveSource } from '../helpers/dataMove';
import { OFFLINE_S3_ENV, runMoveCli } from '../helpers/moveCli';

// The same-file check compared paths as text, so DATABASE_URL naming --from another way (another
// case on the Mac's case-insensitive disk, or a symlink) passed it: the move opened the user's own
// tracker as the target and migrated it in place (0003 -> 0004) before refusing the same ids. No
// file is a target now, so nothing opens it.
describe('a move target that is the source file under another name', () => {
  it.each(['another case', 'a symlink'])('leaves the source untouched: %s', async (spelling) => {
    const source = await writeMoveSource();
    const before = await sha256(source.file);
    const target =
      spelling === 'a symlink' ? join(source.dir, 'link.db') : join(source.dir, 'TRACKER.db');
    if (spelling === 'a symlink') await symlink(source.file, target);

    const result = await runMoveCli(['--from', source.file, '--uploads', source.uploads], {
      ...OFFLINE_S3_ENV,
      DATABASE_URL: target,
    });

    expect(sourceMigrations(source.file)).toEqual([
      '0001_initial',
      '0002_ticket_client_id',
      '0003_attachment_position',
    ]);
    expect(await sha256(source.file)).toBe(before);
    expect(result).toMatchObject({ code: 1, stdout: '' });
  });
});
