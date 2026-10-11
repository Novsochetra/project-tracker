import type { CreatedResetLink, InvitedUser } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { DEFAULT_LOGIN_LIMITS } from '../../src/auth/loginLimits';
import { RESET_TTL_MS } from '../../src/auth/passwordResets';
import { cookieOf, OWNER, testClock } from '../helpers/auth';
import {
  canRead,
  errorOf,
  invitePerson,
  logIn,
  ownerCookie,
  PERSON,
  sender,
} from '../helpers/accounts';
import { addUser } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

const NEW_PASSWORD = 'a password set by link';
const FAILED = 'This reset link does not work. Ask the owner for a new one.';
const USED = 'This reset link was already used. Sign in, or ask the owner for a new one.';

describe.each(DIALECTS)('password reset links (%s)', (dialect) => {
  const clock = testClock();
  const roomy = { ...DEFAULT_LOGIN_LIMITS, perAddress: { max: 1_000, windowMs: 60_000 } };
  const api = useTestServer(dialect, { now: clock.now, auth: { loginLimits: roomy } });
  const send = sender(() => api.app);

  async function resetLink(owner: string, userId: string): Promise<CreatedResetLink> {
    const response = await send('POST', `/api/users/${userId}/reset-link`, owner);
    expect(response.status).toBe(201);
    return (await response.json()) as CreatedResetLink;
  }

  const use = (secret: string, password = NEW_PASSWORD) =>
    send('POST', '/api/password-resets/use', undefined, { secret, password });

  const check = (secret: string) =>
    send('POST', '/api/password-resets/check', undefined, { secret });

  const people = async (owner: string) =>
    (await (await send('GET', '/api/users', owner)).json()) as InvitedUser[];

  it('sets the password of an invited person and ends all their sessions', async () => {
    const owner = await ownerCookie(api);
    const person = await invitePerson(send, owner);
    const laptop = cookieOf(await logIn(send, PERSON.email, PERSON.password));
    const { secret, expiresAt } = await resetLink(owner, person.id);
    expect(expiresAt).toBe(clock.now() + RESET_TTL_MS);
    expect(await (await check(secret)).json()).toEqual({ email: PERSON.email, expiresAt });
    expect((await people(owner))[0]?.resetExpiresAt).toBe(expiresAt);

    expect((await use(secret)).status).toBe(204);
    expect(await canRead(send, person.cookie)).toBe(false);
    expect(await canRead(send, laptop)).toBe(false);
    expect(await canRead(send, owner)).toBe(true);
    expect((await logIn(send, PERSON.email, PERSON.password)).status).toBe(401);
    expect((await logIn(send, PERSON.email, NEW_PASSWORD)).status).toBe(200);
    expect((await people(owner))[0]?.resetExpiresAt).toBeNull();
  });

  it('works once', async () => {
    const owner = await ownerCookie(api);
    const { secret } = await resetLink(owner, (await invitePerson(send, owner)).id);
    expect((await use(secret)).status).toBe(204);
    const again = await use(secret, 'another long password');
    expect(again.status).toBe(404);
    expect(await errorOf(again)).toBe(USED);
    expect((await logIn(send, PERSON.email, NEW_PASSWORD)).status).toBe(200);
  });

  it('expires after 24 hours', async () => {
    const owner = await ownerCookie(api);
    const { secret } = await resetLink(owner, (await invitePerson(send, owner)).id);
    clock.advance(RESET_TTL_MS);
    const late = await use(secret);
    expect(late.status).toBe(404);
    expect(await errorOf(late)).toBe('This reset link has expired. Ask the owner for a new one.');
    expect((await logIn(send, PERSON.email, PERSON.password)).status).toBe(200);
  });

  it('refuses a wrong link, an invite link, and a link a newer one replaced', async () => {
    const owner = await ownerCookie(api);
    const person = await invitePerson(send, owner);
    const first = await resetLink(owner, person.id);
    const second = await resetLink(owner, person.id);
    const invite = (await (await send('POST', '/api/invites', owner)).json()) as {
      secret: string;
    };
    for (const wrong of [
      'nothing-like-it',
      second.secret.slice(0, -1),
      invite.secret,
      first.secret,
    ]) {
      const response = await use(wrong);
      expect(response.status).toBe(404);
      expect(await errorOf(response)).toBe(FAILED);
    }
    const asInvite = await send('POST', '/api/invites/check', undefined, { secret: second.secret });
    expect(asInvite.status).toBe(404);
    expect((await use(second.secret)).status).toBe(204);
  });

  it('keeps the link when the new password is short', async () => {
    const owner = await ownerCookie(api);
    const { secret } = await resetLink(owner, (await invitePerson(send, owner)).id);
    const short = await use(secret, 'too short');
    expect(short.status).toBe(400);
    expect((await use(secret)).status).toBe(204);
  });

  it('lets the owner cancel an open link', async () => {
    const owner = await ownerCookie(api);
    const person = await invitePerson(send, owner);
    const { secret } = await resetLink(owner, person.id);
    expect((await send('DELETE', `/api/users/${person.id}/reset-link`, owner)).status).toBe(204);
    expect((await use(secret)).status).toBe(404);
    expect((await send('DELETE', `/api/users/${person.id}/reset-link`, owner)).status).toBe(404);
  });

  it('lets only the owner, signed in with the password, list people and make or cancel links', async () => {
    expect((await send('GET', '/api/users')).status).toBe(403);
    const owner = await ownerCookie(api);
    const person = await invitePerson(send, owner);
    const user = await addUser(api.db, 'user@example.com', clock.now() + 1);
    const token = { authorization: `Bearer ${user.helper.token}` };
    const path = `/api/users/${person.id}/reset-link`;
    expect((await send('GET', '/api/users', person.cookie)).status).toBe(403);
    expect((await send('POST', path, person.cookie)).status).toBe(403);
    expect((await api.app.request(path, { method: 'POST', headers: token })).status).toBe(403);
    await resetLink(owner, person.id);
    expect((await send('DELETE', path, user.person.cookie)).status).toBe(403);
    expect((await people(owner)).map((row) => row.email)).toEqual([
      PERSON.email,
      'user@example.com',
    ]);
  });

  it('makes no link for the owner or an account that does not exist', async () => {
    const owner = await ownerCookie(api);
    const ownerId = (await api.db.selectFrom('users').select('id').executeTakeFirstOrThrow()).id;
    expect((await send('POST', `/api/users/${ownerId}/reset-link`, owner)).status).toBe(404);
    expect((await send('POST', '/api/users/nobody/reset-link', owner)).status).toBe(404);
    expect((await logIn(send, OWNER.email, OWNER.password)).status).toBe(200);
  });

  it('keeps one open link for an account made twice at once', async () => {
    const owner = await ownerCookie(api);
    const person = await invitePerson(send, owner);
    const path = `/api/users/${person.id}/reset-link`;
    const answers = await Promise.all([send('POST', path, owner), send('POST', path, owner)]);
    expect(answers.map((answer) => answer.status)).toContain(201);
    expect(answers.every((answer) => [201, 409].includes(answer.status))).toBe(true);
    const open = await api.db
      .selectFrom('invites')
      .select('id')
      .where('kind', '=', 'reset')
      .where('usedAt', 'is', null)
      .execute();
    expect(open).toHaveLength(1);
  });

  it('sets the password once from one link used three times at once', async () => {
    const owner = await ownerCookie(api);
    const { secret } = await resetLink(owner, (await invitePerson(send, owner)).id);
    const passwords = ['first long password', 'second long password', 'third long password'];
    const answers = await Promise.all(passwords.map((password) => use(secret, password)));
    expect(answers.map((answer) => answer.status).sort()).toEqual([204, 404, 404]);
    const signIns = await Promise.all(passwords.map((p) => logIn(send, PERSON.email, p)));
    expect(signIns.map((answer) => answer.status).sort()).toEqual([200, 401, 401]);
  });
});

describe.each(DIALECTS)('reset links tried too often (%s)', (dialect) => {
  const strict = { ...DEFAULT_LOGIN_LIMITS, perAddress: { max: 2, windowMs: 60_000 } };
  const api = useTestServer(dialect, { auth: { loginLimits: strict } });
  const send = sender(() => api.app);

  it('get 429 from one address, a mistyped form is no try, and invites keep their own count', async () => {
    const short = await send('POST', '/api/password-resets/use', undefined, {
      secret: 'guess',
      password: 'short',
    });
    expect(short.status).toBe(400);
    const check = () => send('POST', '/api/password-resets/check', undefined, { secret: 'guess' });
    expect((await check()).status).toBe(404);
    expect((await check()).status).toBe(404);
    const refused = await check();
    expect(refused.status).toBe(429);
    expect(refused.headers.get('retry-after')).toBe('60');
    const use = await send('POST', '/api/password-resets/use', undefined, {
      secret: 'guess',
      password: NEW_PASSWORD,
    });
    expect(use.status).toBe(429);
    const invite = await send('POST', '/api/invites/check', undefined, { secret: 'guess' });
    expect(invite.status).toBe(404);
  });
});
