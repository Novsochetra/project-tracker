import { describe, expect, it } from 'vitest';
import { parseMoveArgs } from '../../src/dataMove/moveArgs';
import { moveTargetSettings } from '../../src/dataMove/moveTarget';

const S3_ENV = {
  S3_BUCKET: 'tracker-files',
  AWS_REGION: 'eu-west-1',
  AWS_ACCESS_KEY_ID: 'key',
  AWS_SECRET_ACCESS_KEY: 'secret',
};

describe('parseMoveArgs', () => {
  it('takes the source paths and the switches, in either form', () => {
    expect(parseMoveArgs(['--from', 'a.db', '--uploads=up'])).toEqual({
      from: 'a.db',
      uploads: 'up',
      dryRun: false,
      allowExisting: false,
    });
    expect(
      parseMoveArgs(['--dry-run', '--from=a=b.db', '--uploads', 'up', '--allow-existing']),
    ).toEqual({ from: 'a=b.db', uploads: 'up', dryRun: true, allowExisting: true });
  });

  it('asks for both paths', () => {
    expect(parseMoveArgs(['--from', 'a.db'])).toEqual({
      error: 'Give the local database with --from and its folder of files with --uploads.',
    });
    expect(parseMoveArgs(['--from', '--uploads', 'up'])).toEqual({
      error: '--from needs a path.',
    });
  });

  it('stops at anything it does not know, so a misspelt dry run moves nothing', () => {
    expect(parseMoveArgs([...['--from', 'a', '--uploads', 'b'], '--dryrun'])).toEqual({
      error: 'Unknown option: --dryrun.',
    });
    expect(parseMoveArgs(['--dry-run=no', '--from', 'a', '--uploads', 'b'])).toEqual({
      error: 'Unknown option: --dry-run=no.',
    });
    expect(parseMoveArgs(['data/tracker.db'])).toEqual({
      error: 'Unknown option: data/tracker.db.',
    });
  });

  it('shows help', () => {
    expect(parseMoveArgs(['--from', 'a', '--help'])).toEqual({ help: true });
  });
});

describe('moveTargetSettings', () => {
  const URL_TEXT = 'postgresql://postgres:pw@db.proxy.rlwy.net:41234/railway';

  it('moves into a postgres:// DATABASE_URL and the S3 bucket', () => {
    expect(moveTargetSettings({ DATABASE_URL: ` ${URL_TEXT} `, ...S3_ENV })).toEqual({
      databaseUrl: URL_TEXT,
      s3: { bucket: 'tracker-files', region: 'eu-west-1', endpoint: null },
    });
  });

  it('never falls back to the data folder, which is the source', () => {
    expect(() => moveTargetSettings({ ...S3_ENV })).toThrow(/^Set DATABASE_URL/);
    expect(() => moveTargetSettings({ DATABASE_URL: '', ...S3_ENV })).toThrow(/^Set DATABASE_URL/);
  });

  it('takes no SQLite file and no folder: neither is what the online tracker reads', () => {
    expect(() => moveTargetSettings({ DATABASE_URL: '/tmp/online.db', ...S3_ENV })).toThrow(
      /^DATABASE_URL is not a postgres:\/\/ URL \(its value is not shown\)/,
    );
    expect(() =>
      moveTargetSettings({ DATABASE_URL: URL_TEXT, UPLOADS_DIR: '/tmp/online-files' }),
    ).toThrow(
      'Set S3_BUCKET, AWS_REGION and the AWS keys (they are in .env): files go only to the S3 ' +
        'bucket the online tracker reads, never to a folder on this computer.',
    );
  });

  it('refuses half an S3 setting, as the server does', () => {
    const env = { DATABASE_URL: URL_TEXT, S3_BUCKET: 'tracker-files' };
    expect(() => moveTargetSettings(env)).toThrow(/AWS_REGION/);
  });
});
