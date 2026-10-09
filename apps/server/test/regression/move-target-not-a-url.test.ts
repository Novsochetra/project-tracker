import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../../src/config';
import { moveTargetSettings } from '../../src/dataMove/moveTarget';
import { writeMoveSource } from '../helpers/dataMove';

const PASSWORD = 's3cret-pw';
const URL_TEXT = `postgresql://mover:${PASSWORD}@db.proxy.rlwy.net:41234/railway`;

// What a paste can bring along: quotes, the variable's name, another scheme.
const NOT_POSTGRES = [
  `"${URL_TEXT}"`,
  `'${URL_TEXT}?sslmode=require'`,
  `DATABASE_URL=${URL_TEXT}`,
  `export DATABASE_PUBLIC_URL="${URL_TEXT}"`,
  `mysql://mover:${PASSWORD}@db.example.test/tracker`,
];

const S3_ENV = {
  S3_BUCKET: 'tracker-files',
  AWS_REGION: 'eu-west-1',
  AWS_ACCESS_KEY_ID: 'key',
  AWS_SECRET_ACCESS_KEY: 'secret',
};

const errorOf = (run: () => unknown): string => {
  try {
    run();
  } catch (error) {
    return (error as Error).message;
  }
  return 'no error';
};

// A dry run read a quoted postgres:// value as a SQLite path that isn't there, and so as an empty
// database in memory: it said the target was empty and would be migrated, against no database at
// all. Any value with :// that isn't postgres:// is refused before anything runs, without showing it.
describe('a move target that is not a postgres:// URL', () => {
  it.each(NOT_POSTGRES)('is refused without its value: %s', (value) => {
    const message = errorOf(() =>
      moveTargetSettings({ DATABASE_URL: value, ...S3_ENV }, { from: 'a.db', uploads: 'up' }),
    );
    expect(message).toMatch(/^DATABASE_URL is neither a postgres:\/\/ URL nor a file path/);
    expect(message).not.toContain(PASSWORD);
    expect(message).not.toContain('rlwy');
  });

  it('stops the dry run before it reads or prints anything', async () => {
    const source = await writeMoveSource();
    const run = promisify(execFile)(
      'npx',
      [
        'tsx',
        'apps/server/src/cli/moveData.ts',
        ...['--from', source.file, '--uploads', source.uploads, '--dry-run'],
      ],
      { cwd: REPO_ROOT, env: { ...process.env, ...S3_ENV, DATABASE_URL: `"${URL_TEXT}"` } },
    );

    const failure = await run.then(
      () => null,
      (error: unknown) => error as { code: number; stdout: string; stderr: string },
    );

    expect(failure).toMatchObject({ code: 1, stdout: '' });
    expect(failure?.stderr).toContain('DATABASE_URL is neither a postgres:// URL nor a file path');
    expect(failure?.stderr).not.toContain(PASSWORD);
  });
});
