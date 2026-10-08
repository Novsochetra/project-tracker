import { PGlite } from '@electric-sql/pglite';
import { TrackerClient } from '@tracker/client';
import type { Actor, ChangeEvent } from '@tracker/shared';
import type { Hono } from 'hono';
import { PGliteDialect } from 'kysely';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { createApp, type AppDeps } from '../../src/app';
import { createDatabase, createKysely } from '../../src/db/createDatabase';
import { migrateToLatest } from '../../src/db/migrator';
import type { Db } from '../../src/db/schema';
import { createBroadcaster } from '../../src/events/broadcaster';
import type { AppEnv } from '../../src/http/env';
import { deleteAllRows } from '../../src/repositories/reset';
import { createMemoryStorage } from '../../src/storage/memoryStorage';

export const DIALECTS = ['sqlite', 'pglite'] as const;

export type TestDialect = (typeof DIALECTS)[number];

export const BASE_URL = 'http://tracker.test';

/** An empty database without any tables. */
export const openTestDatabase = (dialect: TestDialect): Db =>
  dialect === 'sqlite'
    ? createDatabase(':memory:')
    : createKysely(
        new PGliteDialect({ pglite: new PGlite({ parsers: { 20: (value) => Number(value) } }) }),
      );

export async function createTestDatabase(dialect: TestDialect): Promise<Db> {
  const db = openTestDatabase(dialect);
  await migrateToLatest(db);
  return db;
}

export interface TestResponse<T> {
  status: number;
  headers: Headers;
  body: T;
}

export interface RequestOptions {
  body?: unknown;
  actor?: Actor;
  headers?: Record<string, string>;
}

export type TestDeps = Omit<AppDeps, 'db' | 'storage' | 'events'>;

export const clientFor = (app: Hono<AppEnv>, options: { actor?: Actor; token?: string } = {}) =>
  new TrackerClient({
    baseUrl: BASE_URL,
    ...options,
    fetch: async (input, init) =>
      app.request(input instanceof Request ? input : String(input), init),
  });

function requestInit(method: string, options: RequestOptions): RequestInit {
  const headers = new Headers(options.headers);
  if (options.actor) {
    headers.set('x-actor-kind', options.actor.kind);
    headers.set('x-actor-name', encodeURIComponent(options.actor.name));
  }
  const isForm = options.body instanceof FormData;
  if (options.body !== undefined && !isForm) headers.set('content-type', 'application/json');
  const body = isForm ? (options.body as FormData) : JSON.stringify(options.body);
  return { method, headers, body: options.body === undefined ? undefined : body };
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  return response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text;
}

export function useTestServer(dialect: TestDialect, deps: TestDeps = {}) {
  const storage = createMemoryStorage();
  const broadcaster = createBroadcaster();
  const events: ChangeEvent[] = [];
  broadcaster.subscribe((event) => events.push(event));
  let state: { db: Db; app: Hono<AppEnv> } | undefined;

  const current = () => {
    if (!state) throw new Error('The test server is not ready yet.');
    return state;
  };

  beforeAll(async () => {
    const db = await createTestDatabase(dialect);
    state = { db, app: createApp({ db, storage, events: broadcaster, ...deps }) };
  });

  beforeEach(async () => {
    await deleteAllRows(current().db);
    storage.files.clear();
    events.length = 0;
  });

  afterAll(async () => {
    await state?.db.destroy();
  });

  const request = async <T = unknown>(
    method: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<TestResponse<T>> => {
    const response = await current().app.request(path, requestInit(method, options));
    return {
      status: response.status,
      headers: response.headers,
      body: (await readBody(response)) as T,
    };
  };

  return {
    storage,
    broadcaster,
    events,
    get db() {
      return current().db;
    },
    get app() {
      return current().app;
    },
    request,
    get: <T = unknown>(path: string, options?: RequestOptions) => request<T>('GET', path, options),
    post: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
      request<T>('POST', path, { ...options, body }),
    patch: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
      request<T>('PATCH', path, { ...options, body }),
    put: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
      request<T>('PUT', path, { ...options, body }),
    delete: <T = unknown>(path: string, options?: RequestOptions) =>
      request<T>('DELETE', path, options),
    client: (actor?: Actor) => clientFor(current().app, { actor }),
  };
}

export type TestServer = ReturnType<typeof useTestServer>;
