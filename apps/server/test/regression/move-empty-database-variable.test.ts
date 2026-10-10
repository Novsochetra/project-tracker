import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, onTestFinished } from 'vitest';
import { moveTargetSettings } from '../../src/dataMove/moveTarget';
import { writeMoveSource } from '../helpers/dataMove';
import { OFFLINE_S3_ENV, runMoveCli } from '../helpers/moveCli';

// docs/deploy-railway.md runs the move after `read -rs DB`. With DB empty (Enter pressed before
// the paste, or the step run in a new terminal tab) DATABASE_URL="$DB?sslmode=require" was
// "?sslmode=require": the move took it as a SQLite file of that name in the folder it ran in (not
// git-ignored), uploaded every file to the real bucket, wrote every row into that file and printed
// "Done." with exit 0, while Railway's Postgres got nothing. Only postgres:// is a target now.
describe('a move target left empty by the documented command', () => {
  it.each(['?sslmode=require', ' ?sslmode=require', 'online.db', './data/online.db', ':memory:'])(
    'is refused: %j',
    (value) => {
      expect(() => moveTargetSettings({ DATABASE_URL: value, ...OFFLINE_S3_ENV })).toThrow(
        /^DATABASE_URL is not a postgres:\/\/ URL/,
      );
    },
  );

  it.each([[[]], [['--dry-run']]])(
    'stops the command %j before it writes or prints anything',
    async (extra) => {
      const source = await writeMoveSource();
      const cwd = await mkdtemp(join(tmpdir(), 'move-cwd-'));
      onTestFinished(() => rm(cwd, { recursive: true, force: true }));

      const result = await runMoveCli(
        ['--from', source.file, '--uploads', source.uploads, ...extra],
        { ...OFFLINE_S3_ENV, DATABASE_URL: '?sslmode=require' },
        cwd,
      );

      expect(result).toMatchObject({ code: 1, stdout: '' });
      expect(result.stderr).toContain('DATABASE_URL is not a postgres:// URL');
      expect(await readdir(cwd)).toEqual([]);
    },
  );
});
