import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config';
import { railwayDatabaseProblem } from '../../src/railway';

const S3 = {
  S3_BUCKET: 'tracker-files',
  AWS_REGION: 'eu-west-1',
  AWS_ACCESS_KEY_ID: 'key',
  AWS_SECRET_ACCESS_KEY: 'secret',
};
const POSTGRES = 'postgresql://postgres:Sup3rSecretPW@postgres.railway.internal:5432/railway';
const RAILWAY = { RAILWAY_ENVIRONMENT_ID: 'env-1', DATABASE_URL: POSTGRES, ...S3 };

const startError = (env: NodeJS.ProcessEnv): string => {
  try {
    loadConfig(env);
    return '';
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

// The guard only checked the values weren't empty. A DATABASE_URL pasted with its quotes passed as a
// SQLite file on the deployment's own disk, which the next deploy replaces, and the start-up line
// printed it, password and all; an UPLOADS_DIR off the volume lost the files the same way.
describe('on Railway, data and files stay off the deployment disk', () => {
  it('refuses a DATABASE_URL that is not postgres:// without showing it', () => {
    for (const url of [`"${POSTGRES}"`, ` ${POSTGRES}`, `DATABASE_URL=${POSTGRES}`]) {
      const message = startError({ ...RAILWAY, DATABASE_URL: url });
      expect(message, url).toMatch(/DATABASE_URL/);
      expect(message, url).not.toContain('Sup3rSecretPW');
    }
    expect(startError(RAILWAY)).toBe('');
  });

  it('takes a SQLite file only on the service volume', () => {
    expect(startError({ ...RAILWAY, DATABASE_URL: '/app/data/tracker.db' })).toMatch(/volume/);
    const volume = { ...RAILWAY, RAILWAY_VOLUME_MOUNT_PATH: '/data' };
    expect(startError({ ...volume, DATABASE_URL: '/data/tracker.db' })).toBe('');
    expect(startError({ ...volume, DATABASE_URL: '/data-old/tracker.db' })).toMatch(/volume/);
    expect(startError({ ...volume, DATABASE_URL: '/data/../app/tracker.db' })).toMatch(/volume/);
  });

  it('takes UPLOADS_DIR instead of S3 only on the service volume', () => {
    const disk = { RAILWAY_ENVIRONMENT_ID: 'env-1', DATABASE_URL: POSTGRES };
    expect(startError({ ...disk, UPLOADS_DIR: '/tmp/u' })).toMatch(/S3_BUCKET/);
    const volume = { ...disk, RAILWAY_VOLUME_MOUNT_PATH: '/data' };
    expect(startError({ ...volume, UPLOADS_DIR: '/data/uploads' })).toBe('');
    expect(startError({ ...volume, UPLOADS_DIR: '/tmp/u' })).toMatch(/volume/);
  });

  // db.js, the pre-deploy command, migrated a throwaway SQLite file and passed the deploy.
  it('gives the pre-deploy command the same answer about the database', () => {
    expect(railwayDatabaseProblem({ RAILWAY_ENVIRONMENT_ID: 'env-1' })).toMatch(/not set/);
    expect(railwayDatabaseProblem({ ...RAILWAY, DATABASE_URL: `"${POSTGRES}"` })).toMatch(
      /postgres:\/\//,
    );
    expect(railwayDatabaseProblem(RAILWAY)).toBeNull();
    expect(railwayDatabaseProblem({ DATABASE_URL: '/tmp/local.db' })).toBeNull();
  });
});
