import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config';
import { loadS3Config } from '../../src/storage/s3Config';
import { describeStorage } from '../../src/storage/openFileStorage';

// Test values only: the checks look at whether the keys are there, never at what they are.
const KEYS = { AWS_ACCESS_KEY_ID: 'test-key-id', AWS_SECRET_ACCESS_KEY: 'test-secret' };
const S3 = { S3_BUCKET: 'tracker-files', AWS_REGION: 'eu-west-1', ...KEYS };

describe('loadS3Config', () => {
  it('keeps files on disk when no bucket is set, as local runs do', () => {
    expect(loadS3Config({})).toBeNull();
    expect(loadS3Config({ S3_BUCKET: '  ' })).toBeNull();
    expect(loadConfig({}).s3).toBeNull();
  });

  it('keeps files on disk with AWS keys set for something else', () => {
    expect(loadS3Config({ ...KEYS, AWS_REGION: 'us-east-1' })).toBeNull();
  });

  it('stores files in S3 when the bucket, region and keys are set', () => {
    expect(loadS3Config(S3)).toEqual({
      bucket: 'tracker-files',
      region: 'eu-west-1',
      endpoint: null,
    });
    expect(loadConfig(S3).s3).toMatchObject({ bucket: 'tracker-files' });
  });

  it('takes an endpoint for an S3-compatible store', () => {
    const endpoint = 'https://account.r2.cloudflarestorage.com';
    expect(loadS3Config({ ...S3, S3_ENDPOINT: ` ${endpoint} ` })).toMatchObject({ endpoint });
    expect(loadS3Config({ ...S3, S3_ENDPOINT: 'http://127.0.0.1:9000' })).toMatchObject({
      endpoint: 'http://127.0.0.1:9000',
    });
  });

  it('stops the server when the S3 settings are half set', () => {
    const failures: [NodeJS.ProcessEnv, string][] = [
      [{ S3_ENDPOINT: 'https://s3.example.com' }, 'S3_ENDPOINT is set but S3_BUCKET is not.'],
      [{ ...S3, AWS_REGION: '' }, 'S3_BUCKET is set but AWS_REGION is not'],
      [{ ...S3, AWS_ACCESS_KEY_ID: '' }, 'S3_BUCKET is set but AWS_ACCESS_KEY_ID is not.'],
      [
        { S3_BUCKET: 'tracker-files', AWS_REGION: 'us-east-1' },
        'S3_BUCKET is set but AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are not.',
      ],
      [{ ...S3, S3_ENDPOINT: 'minio:9000' }, 'S3_ENDPOINT must be an http or https URL'],
      [{ ...S3, S3_BUCKET: 's3://tracker-files' }, 'S3_BUCKET must be a bucket name'],
      [{ ...S3, S3_BUCKET: 'Tracker_Files' }, 'S3_BUCKET must be a bucket name'],
    ];
    for (const [env, message] of failures) {
      expect(() => loadS3Config(env), message).toThrow(message);
      expect(() => loadConfig(env), message).toThrow(message);
    }
  });

  it('never puts a key in its messages', () => {
    for (const env of [
      { ...S3, AWS_SECRET_ACCESS_KEY: '' },
      { ...S3, S3_ENDPOINT: 'nope' },
    ]) {
      const message = (() => {
        try {
          loadS3Config(env);
          return '';
        } catch (error) {
          return (error as Error).message;
        }
      })();
      expect(message).not.toBe('');
      expect(message).not.toContain(KEYS.AWS_ACCESS_KEY_ID);
      expect(message).not.toContain(KEYS.AWS_SECRET_ACCESS_KEY);
    }
  });
});

describe('describeStorage', () => {
  it('names where files go, for the start-up log', () => {
    expect(describeStorage({ s3: null, uploadsDir: '/data/uploads' })).toBe('/data/uploads');
    const s3 = { bucket: 'tracker-files', region: 'eu-west-1', endpoint: null };
    expect(describeStorage({ s3, uploadsDir: '/data/uploads' })).toBe(
      'S3 bucket tracker-files (eu-west-1)',
    );
  });
});
