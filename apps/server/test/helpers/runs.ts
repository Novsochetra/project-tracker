import { randomUUID } from 'node:crypto';
import type { Hono } from 'hono';
import { createApiToken } from '../../src/auth/apiTokens';
import { startSession } from '../../src/auth/sessions';
import type { Db } from '../../src/db/schema';
import type { AppEnv } from '../../src/http/env';
import { SESSION_COOKIE } from '../../src/http/sessionCookie';
import { insertUser } from '../../src/repositories/users';

export interface Auth {
  cookie?: string;
  token?: string;
}

export interface UserAuth {
  id: string;
  person: Auth;
  helper: Auth;
}

export interface Answer<T = unknown> {
  status: number;
  body: T;
}

// Only one account can sign in with a password today, so sessions are made in the database.
export async function addUser(db: Db, email: string, now: number): Promise<UserAuth> {
  const id = randomUUID();
  await insertUser(db, { id, email, passwordHash: 'unused', createdAt: now, updatedAt: now });
  const { secret } = await startSession(db, id, now);
  const token = await createApiToken(db, id, `${email} laptop`, now);
  return { id, person: { cookie: `${SESSION_COOKIE}=${secret}` }, helper: { token: token.secret } };
}

function headersOf(auth: Auth, body: unknown): Record<string, string> {
  return {
    ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    ...(auth.cookie ? { cookie: auth.cookie } : {}),
    ...(auth.token ? { authorization: `Bearer ${auth.token}` } : {}),
  };
}

export function caller(app: () => Hono<AppEnv>, auth: Auth) {
  return async <T = unknown>(method: string, path: string, body?: unknown): Promise<Answer<T>> => {
    const response = await app().request(path, {
      method,
      headers: headersOf(auth, body),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    return { status: response.status, body: (text ? JSON.parse(text) : null) as T };
  };
}

export type Caller = ReturnType<typeof caller>;

export const helperName = (name: string) => ({ name, projectKeys: ['MOB'] });
