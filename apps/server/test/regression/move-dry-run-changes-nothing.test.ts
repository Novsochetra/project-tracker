import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, onTestFinished } from 'vitest';
import { runMove } from '../../src/dataMove/runMove';
import { openMoveTarget, writeMoveSource } from '../helpers/dataMove';
import { CLOSED_POSTGRES_URL, runMoveCli } from '../helpers/moveCli';

// Opening disk storage removes the partial files an interrupted upload leaves, so a dry run with
// UPLOADS_DIR deleted files in that folder before it had read anything. A folder is no target
// now, and a dry run never opens the target's storage.
describe('a dry run', () => {
  it('leaves a folder named in UPLOADS_DIR as it is', async () => {
    const source = await writeMoveSource();
    const folder = await mkdtemp(join(tmpdir(), 'move-uploads-dir-'));
    onTestFinished(() => rm(folder, { recursive: true, force: true }));
    await writeFile(join(folder, '.upload-in-flight-f1.png.partial'), 'half a file');

    const result = await runMoveCli(
      ['--from', source.file, '--uploads', source.uploads, '--dry-run'],
      { DATABASE_URL: CLOSED_POSTGRES_URL, UPLOADS_DIR: folder },
    );

    expect(result).toMatchObject({ code: 1, stdout: '' });
    expect(await readdir(folder)).toEqual(['.upload-in-flight-f1.png.partial']);
  });

  it('never opens the target storage', async () => {
    const source = await writeMoveSource();
    const target = await openMoveTarget('sqlite', null);
    const lines: string[] = [];

    const ok = await runMove(
      { from: source.file, uploads: source.uploads, dryRun: true, allowExisting: false },
      {
        db: target.db,
        openStorage: () => Promise.reject(new Error('A dry run opened the storage.')),
        say: (line) => lines.push(line),
      },
    );

    expect(ok).toBe(true);
    expect(lines.at(-1)).toBe('Dry run: nothing was written.');
  });
});
