import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseMoveArgs } from '../../src/dataMove/moveArgs';
import { moveTargetSettings } from '../../src/dataMove/moveTarget';

const PATHS = { from: 'data/tracker.db', uploads: 'data/uploads' };

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
  it('moves into DATABASE_URL and the S3 bucket', () => {
    const url = 'postgresql://postgres:pw@db.proxy.rlwy.net:41234/railway?sslmode=require';
    expect(moveTargetSettings({ DATABASE_URL: url, ...S3_ENV }, PATHS)).toEqual({
      databaseUrl: url,
      storage: {
        s3: { bucket: 'tracker-files', region: 'eu-west-1', endpoint: null },
        uploadsDir: '',
      },
    });
  });

  it('moves files into UPLOADS_DIR without a bucket', () => {
    const env = { DATABASE_URL: '/tmp/online.db', UPLOADS_DIR: '/tmp/online-files' };
    expect(moveTargetSettings(env, PATHS).storage).toEqual({
      s3: null,
      uploadsDir: '/tmp/online-files',
    });
  });

  it('never falls back to the data folder, which is the source', () => {
    expect(() => moveTargetSettings({ ...S3_ENV }, PATHS)).toThrow(/^Set DATABASE_URL/);
    expect(() => moveTargetSettings({ DATABASE_URL: '/tmp/online.db' }, PATHS)).toThrow(
      'Set S3_BUCKET with AWS_REGION and the AWS keys (or UPLOADS_DIR) for where the files go.',
    );
  });

  it('refuses to move a tracker into itself', () => {
    const sameFile = { DATABASE_URL: join(process.cwd(), PATHS.from), ...S3_ENV };
    expect(() => moveTargetSettings(sameFile, PATHS)).toThrow('DATABASE_URL is the file');
    const sameFolder = { DATABASE_URL: '/tmp/online.db', UPLOADS_DIR: './data/uploads/' };
    expect(() => moveTargetSettings(sameFolder, PATHS)).toThrow('UPLOADS_DIR is the folder');
  });

  it('refuses half an S3 setting, as the server does', () => {
    const env = { DATABASE_URL: '/tmp/online.db', S3_BUCKET: 'tracker-files' };
    expect(() => moveTargetSettings(env, PATHS)).toThrow(/AWS_REGION/);
  });
});
