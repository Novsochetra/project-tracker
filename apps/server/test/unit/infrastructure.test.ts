import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createClock } from '../../src/clock';
import { DEFAULT_PORT, REPO_ROOT, loadConfig } from '../../src/config';
import { isPostgresUrl } from '../../src/db/createDatabase';
import { isUniqueViolation } from '../../src/db/errors';
import { createBroadcaster } from '../../src/events/broadcaster';

describe('createClock', () => {
  it('never repeats or goes back within a millisecond', () => {
    const now = vi.fn(() => 1000);
    const clock = createClock(now);
    expect([clock(), clock(), clock()]).toEqual([1000, 1001, 1002]);
    now.mockReturnValue(5000);
    expect(clock()).toBe(5000);
    now.mockReturnValue(10);
    expect(clock()).toBe(5001);
  });

  it('reserves consecutive stamps for one operation', () => {
    const clock = createClock(() => 1000);
    expect(clock(3)).toBe(1000);
    expect(clock()).toBe(1003);
    expect(clock(0)).toBe(1004);
    expect(clock()).toBe(1005);
  });
});

describe('loadConfig', () => {
  it('uses repo-relative defaults', () => {
    const config = loadConfig({});
    expect(config).toMatchObject({
      port: DEFAULT_PORT,
      host: '127.0.0.1',
      databaseUrl: join(REPO_ROOT, 'data', 'tracker.db'),
      uploadsDir: join(REPO_ROOT, 'data', 'uploads'),
      webDist: join(REPO_ROOT, 'apps', 'web', 'dist'),
      auth: {
        openWithoutOwner: 'local',
        trustedProxies: 0,
        secureCookies: false,
        legacyToken: false,
      },
      testReset: false,
      repoRoot: REPO_ROOT,
      publicUrl: null,
    });
    expect(config.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('reads the environment', () => {
    const config = loadConfig({
      PORT: '4199',
      HOST: '0.0.0.0',
      DATABASE_URL: ':memory:',
      UPLOADS_DIR: '/tmp/u',
      TRACKER_TOKEN: 'secret',
      WEB_DIST: '/tmp/web',
      TRACKER_TEST_RESET: '1',
    });
    expect(config).toMatchObject({
      port: 4199,
      host: '0.0.0.0',
      databaseUrl: ':memory:',
      uploadsDir: '/tmp/u',
      auth: { openWithoutOwner: false, legacyToken: true },
      webDist: '/tmp/web',
      testReset: true,
    });
    expect(loadConfig({ PORT: 'abc', TRACKER_TEST_RESET: 'true' })).toMatchObject({
      port: DEFAULT_PORT,
      testReset: false,
    });
  });

  it('reads the public URL agents use, without a trailing slash', () => {
    const publicUrl = (value: string) => loadConfig({ PUBLIC_URL: value }).publicUrl;
    expect(publicUrl(' https://tracker.example.com/ ')).toBe('https://tracker.example.com');
    expect(publicUrl('http://10.0.0.5:4100')).toBe('http://10.0.0.5:4100');
    expect(publicUrl('https://example.com/tracker/')).toBe('https://example.com/tracker');
    expect(publicUrl('tracker.example.com')).toBeNull();
    expect(publicUrl('ftp://tracker.example.com')).toBeNull();
    expect(publicUrl('')).toBeNull();
  });

  it('tells Postgres URLs from SQLite paths', () => {
    expect(isPostgresUrl('postgres://u@h/db')).toBe(true);
    expect(isPostgresUrl('postgresql://u@h/db')).toBe(true);
    expect(isPostgresUrl(':memory:')).toBe(false);
    expect(isPostgresUrl('/data/tracker.db')).toBe(false);
  });
});

describe('isUniqueViolation', () => {
  const failure = (code: unknown) => Object.assign(new Error('refused'), { code });

  it('knows a unique index refusing a row in SQLite and in Postgres', () => {
    expect(isUniqueViolation(failure('SQLITE_CONSTRAINT_UNIQUE'))).toBe(true);
    expect(isUniqueViolation(failure('23505'))).toBe(true);
  });

  it('leaves out every other failure', () => {
    expect(isUniqueViolation(failure('SQLITE_CONSTRAINT_FOREIGNKEY'))).toBe(false);
    expect(isUniqueViolation(failure('23503'))).toBe(false);
    expect(isUniqueViolation(failure(23505))).toBe(false);
    expect(isUniqueViolation(new Error('UNIQUE constraint failed: tickets.client_id'))).toBe(false);
    expect(isUniqueViolation('23505')).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});

describe('createBroadcaster', () => {
  it('delivers to subscribers until they unsubscribe, isolating failing listeners', () => {
    const broadcaster = createBroadcaster();
    const received: unknown[] = [];
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    broadcaster.subscribe(() => {
      throw new Error('boom');
    });
    const unsubscribe = broadcaster.subscribe((event) => received.push(event));
    const event = { type: 'changed', projectId: 'p', ticketId: null } as const;
    broadcaster.publish(event);
    expect(received).toEqual([event]);
    expect(error).toHaveBeenCalledOnce();
    unsubscribe();
    broadcaster.publish(event);
    expect(received).toHaveLength(1);
    expect(broadcaster.listenerCount()).toBe(1);
    error.mockRestore();
  });
});
