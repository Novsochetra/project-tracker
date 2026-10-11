import type { CreatedInvite, InvitedUser } from '@tracker/shared';
import type { Hono } from 'hono';
import { expect } from 'vitest';
import type { AppEnv } from '../../src/http/env';
import { addOwner, cookieOf, JSON_HEADERS, signIn } from './auth';
import type { TestServer } from './server';

export const PERSON = { name: 'Sam', email: 'sam@example.com', password: 'a long first password' };

export type Send = (
  method: string,
  path: string,
  cookie?: string,
  body?: unknown,
) => Promise<Response>;

export const sender =
  (app: () => Hono<AppEnv>): Send =>
  async (method, path, cookie, body) =>
    app().request(path, {
      method,
      headers: { ...JSON_HEADERS, ...(cookie ? { cookie } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

export const errorOf = async (response: Response): Promise<string> =>
  ((await response.json()) as { error: { message: string } }).error.message;

export async function ownerCookie(api: TestServer): Promise<string> {
  await addOwner(api.db);
  return signIn(api.app);
}

// Made the way a person makes one, so it has a real password to sign in with.
export async function invitePerson(
  send: Send,
  owner: string,
  person = PERSON,
): Promise<{ id: string; cookie: string }> {
  const invite = (await (await send('POST', '/api/invites', owner)).json()) as CreatedInvite;
  const accepted = await send('POST', '/api/invites/accept', undefined, {
    secret: invite.secret,
    ...person,
  });
  expect(accepted.status).toBe(201);
  const users = (await (await send('GET', '/api/users', owner)).json()) as InvitedUser[];
  const id = users.find((user) => user.email === person.email)?.id ?? '';
  return { id, cookie: cookieOf(accepted) };
}

export const logIn = (send: Send, email: string, password: string) =>
  send('POST', '/api/session', undefined, { email, password });

export const canRead = async (send: Send, cookie: string): Promise<boolean> =>
  (await send('GET', '/api/projects', cookie)).status === 200;
