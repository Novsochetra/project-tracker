import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { createClock } from '../../src/clock';
import { DEFAULT_PORT, REPO_ROOT, loadConfig } from '../../src/config';
import { isPostgresUrl } from '../../src/db/createDatabase';
import { createBroadcaster } from '../../src/events/broadcaster';
import { createDiskStorage } from '../../src/storage/diskStorage';

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
      token: null,
      testReset: false,
      repoRoot: REPO_ROOT,
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
      token: 'secret',
      webDist: '/tmp/web',
      testReset: true,
    });
    expect(loadConfig({ PORT: 'abc', TRACKER_TEST_RESET: 'true' })).toMatchObject({
      port: DEFAULT_PORT,
      testReset: false,
    });
  });

  it('tells Postgres URLs from SQLite paths', () => {
    expect(isPostgresUrl('postgres://u@h/db')).toBe(true);
    expect(isPostgresUrl('postgresql://u@h/db')).toBe(true);
    expect(isPostgresUrl(':memory:')).toBe(false);
    expect(isPostgresUrl('/data/tracker.db')).toBe(false);
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

describe('createDiskStorage', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tracker-uploads-'));
  const storage = createDiskStorage(join(dir, 'nested'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('writes, streams and removes files', async () => {
    await storage.write('a.png', new Uint8Array([1, 2, 3]));
    const stream = await storage.read('a.png');
    expect(new Uint8Array(await new Response(stream).arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3]),
    );
    await storage.remove('a.png');
    expect(await storage.read('a.png')).toBeNull();
    await expect(storage.remove('a.png')).resolves.toBeUndefined();
  });

  it('refuses keys that could escape the folder', async () => {
    await expect(storage.write('../evil', new Uint8Array())).rejects.toThrow('Invalid storage key');
    await expect(storage.read('.hidden')).rejects.toThrow('Invalid storage key');
  });
});
