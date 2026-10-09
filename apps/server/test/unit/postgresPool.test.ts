import pg from 'pg';
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_POOL_MAX,
  DEFAULT_STATEMENT_TIMEOUT_MS,
  createPostgresPool,
  postgresPoolConfig,
  withLibpqSslMode,
} from '../../src/db/postgresPool';

// Railway's private-network URL: no sslmode, and the password needs escaping.
const RAILWAY = 'postgresql://postgres:pa%40ss@postgres.railway.internal:5432/railway';
const PUBLIC = 'postgresql://postgres:pa%40ss@roundhouse.proxy.rlwy.net:41234/railway';

interface Parameters {
  ssl: unknown;
  password: string;
  host: string;
  statement_timeout: unknown;
}

// What node-postgres connects with, after its own reading of the URL and environment.
const parametersOf = (url: string, env: NodeJS.ProcessEnv = {}): Parameters =>
  (new pg.Client(postgresPoolConfig(url, env)) as unknown as { connectionParameters: Parameters })
    .connectionParameters;

describe('SSL for Postgres', () => {
  it('leaves a URL without sslmode as it is, like the private network on Railway', () => {
    expect(withLibpqSslMode(RAILWAY, {})).toBe(RAILWAY);
    expect(parametersOf(RAILWAY)).toMatchObject({
      ssl: false,
      password: 'pa@ss',
      host: 'postgres.railway.internal',
    });
  });

  it("gives sslmode libpq's meaning: require encrypts without checking the certificate", () => {
    const url = `${PUBLIC}?sslmode=require`;
    expect(withLibpqSslMode(url, {})).toBe(`${url}&uselibpqcompat=true`);
    expect(parametersOf(url).ssl).toEqual({ rejectUnauthorized: false });
    expect(parametersOf(url).password).toBe('pa@ss');
    expect(parametersOf(`${PUBLIC}?sslmode=prefer`).ssl).toEqual({ rejectUnauthorized: false });
    expect(parametersOf(`${PUBLIC}?sslmode=no-verify`).ssl).toEqual({ rejectUnauthorized: false });
  });

  it('checks the certificate for verify-full and turns SSL off for disable and allow', () => {
    expect(parametersOf(`${PUBLIC}?sslmode=verify-full`).ssl).toEqual({});
    expect(parametersOf(`${PUBLIC}?sslmode=disable`).ssl).toBe(false);
    expect(parametersOf(`${PUBLIC}?sslmode=allow`).ssl).toBe(false);
  });

  it('takes PGSSLMODE when the URL has no sslmode, and the URL when it has', () => {
    expect(parametersOf(PUBLIC, { PGSSLMODE: 'require' }).ssl).toEqual({
      rejectUnauthorized: false,
    });
    expect(parametersOf(`${PUBLIC}?sslmode=disable`, { PGSSLMODE: 'require' }).ssl).toBe(false);
  });
});

describe('the Postgres pool', () => {
  it('has 10 connections and a 30 s statement timeout unless told otherwise', () => {
    expect(postgresPoolConfig(RAILWAY, {})).toMatchObject({
      max: DEFAULT_POOL_MAX,
      statement_timeout: DEFAULT_STATEMENT_TIMEOUT_MS,
      connectionTimeoutMillis: 10_000,
      idle_in_transaction_session_timeout: 60_000,
    });
    expect(DEFAULT_POOL_MAX).toBe(10);
    expect(DEFAULT_STATEMENT_TIMEOUT_MS).toBe(30_000);
    const env = { DATABASE_POOL_MAX: '4', DATABASE_STATEMENT_TIMEOUT_MS: '0' };
    expect(postgresPoolConfig(RAILWAY, env)).toMatchObject({ max: 4, statement_timeout: 0 });
  });

  it('ignores settings that are not whole numbers in range', () => {
    for (const value of ['abc', '-1', '2.5', '']) {
      const env = { DATABASE_POOL_MAX: value, DATABASE_STATEMENT_TIMEOUT_MS: value };
      expect(postgresPoolConfig(RAILWAY, env)).toMatchObject({
        max: DEFAULT_POOL_MAX,
        statement_timeout: DEFAULT_STATEMENT_TIMEOUT_MS,
      });
    }
    expect(postgresPoolConfig(RAILWAY, { DATABASE_POOL_MAX: '0' }).max).toBe(DEFAULT_POOL_MAX);
  });

  it('sends the statement timeout to the server when it connects', () => {
    expect(parametersOf(RAILWAY).statement_timeout).toBe(DEFAULT_STATEMENT_TIMEOUT_MS);
  });

  it('logs a connection the database dropped instead of ending the process', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const pool = createPostgresPool(RAILWAY, {});
    try {
      expect(() => pool.emit('error', new Error('terminating connection'))).not.toThrow();
      expect(error).toHaveBeenCalledWith(
        'A Postgres connection was lost:',
        'terminating connection',
      );
    } finally {
      error.mockRestore();
      await pool.end();
    }
  });
});
