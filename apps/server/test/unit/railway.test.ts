import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config';
import { onRailway, railwayProblems, withRailwayDefaults } from '../../src/railway';

const RAILWAY = {
  RAILWAY_ENVIRONMENT_ID: 'env-1',
  RAILWAY_PUBLIC_DOMAIN: 'tracker-production.up.railway.app',
  DATABASE_URL: 'postgres://tracker:secret@postgres.railway.internal:5432/railway',
  UPLOADS_DIR: '/data/uploads',
};

describe('Railway defaults', () => {
  it('leaves other hosts alone', () => {
    const env = { HOST: '127.0.0.1' };
    expect(onRailway(env)).toBe(false);
    expect(withRailwayDefaults(env)).toBe(env);
    expect(withRailwayDefaults({})).toEqual({});
  });

  it('listens on every interface, trusts one proxy and names the public domain', () => {
    expect(withRailwayDefaults(RAILWAY)).toMatchObject({
      HOST: '0.0.0.0',
      TRUST_PROXY: '1',
      PUBLIC_URL: 'https://tracker-production.up.railway.app',
    });
  });

  it('keeps variables that are set', () => {
    const env = {
      ...RAILWAY,
      HOST: '::',
      TRUST_PROXY: '2',
      PUBLIC_URL: 'https://tracker.example.com',
    };
    expect(withRailwayDefaults(env)).toMatchObject({
      HOST: '::',
      TRUST_PROXY: '2',
      PUBLIC_URL: 'https://tracker.example.com',
    });
    expect(
      withRailwayDefaults({ ...RAILWAY, RAILWAY_PUBLIC_DOMAIN: '' }).PUBLIC_URL,
    ).toBeUndefined();
  });

  it('refuses to keep data or files on the deployment disk', () => {
    expect(railwayProblems(RAILWAY)).toEqual([]);
    expect(railwayProblems({ ...RAILWAY, UPLOADS_DIR: undefined, S3_BUCKET: 'files' })).toEqual([]);
    const bare = railwayProblems({ RAILWAY_ENVIRONMENT_ID: 'env-1', DATABASE_URL: ' ' });
    expect(bare).toHaveLength(2);
    expect(bare[0]).toMatch(/^DATABASE_URL is not set/);
    expect(bare[1]).toMatch(/^S3_BUCKET is not set/);
    expect(() => withRailwayDefaults({ RAILWAY_ENVIRONMENT_ID: 'env-1' })).toThrow(/DATABASE_URL/);
  });

  it('makes the server config public and closed behind the proxy', () => {
    const config = loadConfig(RAILWAY);
    expect(config.host).toBe('0.0.0.0');
    expect(config.publicUrl).toBe('https://tracker-production.up.railway.app');
    expect(config.auth).toMatchObject({ trustedProxies: 1, openWithoutOwner: false });
    expect(() => loadConfig({ RAILWAY_ENVIRONMENT_ID: 'env-1' })).toThrow(/S3_BUCKET/);
  });
});
