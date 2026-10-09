import type { Hono } from 'hono';
import { expect } from 'vitest';
import { setOwner } from '../../src/auth/owner';
import type { ScryptParams } from '../../src/auth/passwords';
import type { Db } from '../../src/db/schema';
import type { AppEnv } from '../../src/http/env';

// Far cheaper than the real cost, so tests that sign in many times stay fast.
export const CHEAP_SCRYPT: ScryptParams = { N: 1024, r: 8, p: 1 };

export const OWNER = { email: 'owner@example.com', password: 'correct horse battery' };

export const addOwner = (db: Db, now = 1_000) => setOwner(db, OWNER, now, CHEAP_SCRYPT);

export const JSON_HEADERS = { 'content-type': 'application/json' };

export function loginRequest(
  credentials: { email: string; password: string } = OWNER,
  headers: Record<string, string> = {},
): RequestInit {
  return {
    method: 'POST',
    headers: { ...JSON_HEADERS, ...headers },
    body: JSON.stringify(credentials),
  };
}

// The cookie as a browser would send it back: name=value.
export const cookieOf = (response: Response): string =>
  (response.headers.get('set-cookie') ?? '').split(';')[0]!;

export async function signIn(app: Hono<AppEnv>, base = ''): Promise<string> {
  const response = await app.request(`${base}/api/session`, loginRequest());
  expect(response.status).toBe(200);
  return cookieOf(response);
}

export interface TestClock {
  now: () => number;
  set: (time: number) => void;
  advance: (ms: number) => void;
}

export function testClock(start = 1_000_000): TestClock {
  let time = start;
  return {
    now: () => time,
    set: (value) => {
      time = value;
    },
    advance: (ms) => {
      time += ms;
    },
  };
}
