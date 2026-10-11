import { describe, expect, it } from 'vitest';
import { WRONG_CURRENT_PASSWORD } from '../../src/auth/changePassword';
import { DEFAULT_LOGIN_LIMITS } from '../../src/auth/loginLimits';
import { addOwner, cookieOf, OWNER, signIn } from '../helpers/auth';
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

const NEW_PASSWORD = 'a brand new password';

describe.each(DIALECTS)('changing the password (%s)', (dialect) => {
  const roomy = { ...DEFAULT_LOGIN_LIMITS, perAddress: { max: 1_000, windowMs: 60_000 } };
  const api = useTestServer(dialect, { auth: { loginLimits: roomy } });
  const send = sender(() => api.app);

  const change = (cookie: string, currentPassword: string, newPassword = NEW_PASSWORD) =>
    send('POST', '/api/password', cookie, { currentPassword, newPassword });

  it('sets the new password, keeps this session and ends the others', async () => {
    const here = await ownerCookie(api);
    const phone = await signIn(api.app);
    expect((await change(here, OWNER.password)).status).toBe(204);

    expect(await canRead(send, here)).toBe(true);
    expect(await canRead(send, phone)).toBe(false);
    expect((await logIn(send, OWNER.email, OWNER.password)).status).toBe(401);
    expect((await logIn(send, OWNER.email, NEW_PASSWORD)).status).toBe(200);
  });

  it('lets an invited person change theirs, and leaves everyone else signed in', async () => {
    const owner = await ownerCookie(api);
    const person = await invitePerson(send, owner);
    const laptop = cookieOf(await logIn(send, PERSON.email, PERSON.password));
    expect((await change(person.cookie, PERSON.password)).status).toBe(204);

    expect(await canRead(send, person.cookie)).toBe(true);
    expect(await canRead(send, laptop)).toBe(false);
    expect(await canRead(send, owner)).toBe(true);
    expect((await logIn(send, PERSON.email, NEW_PASSWORD)).status).toBe(200);
  });

  it('refuses a wrong current password and changes nothing', async () => {
    const here = await ownerCookie(api);
    const phone = await signIn(api.app);
    const wrong = await change(here, 'not the password');
    expect(wrong.status).toBe(400);
    expect(await errorOf(wrong)).toBe(WRONG_CURRENT_PASSWORD);
    expect(await canRead(send, phone)).toBe(true);
    expect((await logIn(send, OWNER.email, OWNER.password)).status).toBe(200);
  });

  it('refuses a new password under 12 characters', async () => {
    const here = await ownerCookie(api);
    const short = await change(here, OWNER.password, 'eleven char');
    expect(short.status).toBe(400);
    expect(await errorOf(short)).toBe('Use at least 12 characters for the password.');
    expect((await logIn(send, OWNER.email, OWNER.password)).status).toBe(200);
  });

  it('needs a session made with the password: not a token, not an open tracker', async () => {
    const open = await change('', OWNER.password);
    expect(open.status).toBe(403);
    await addOwner(api.db);
    const user = await addUser(api.db, 'user@example.com', 1_000);
    const byToken = await api.app.request('/api/password', {
      method: 'POST',
      headers: { authorization: `Bearer ${user.helper.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ currentPassword: 'x', newPassword: NEW_PASSWORD }),
    });
    expect(byToken.status).toBe(403);
    expect((await change('', OWNER.password)).status).toBe(401);
  });
});

describe.each(DIALECTS)('changing the password too often (%s)', (dialect) => {
  const strict = { ...DEFAULT_LOGIN_LIMITS, perAddress: { max: 2, windowMs: 60_000 } };
  const api = useTestServer(dialect, { auth: { loginLimits: strict } });
  const send = sender(() => api.app);

  it('gets 429 per account, a mistyped form is no try, and sign-in keeps its own count', async () => {
    const here = await ownerCookie(api);
    const change = (currentPassword: string, newPassword = NEW_PASSWORD) =>
      send('POST', '/api/password', here, { currentPassword, newPassword });
    expect((await change(OWNER.password, 'short')).status).toBe(400);
    expect((await change('')).status).toBe(400);
    expect((await change('guess one')).status).toBe(400);
    expect((await change('guess two')).status).toBe(400);
    const refused = await change(OWNER.password);
    expect(refused.status).toBe(429);
    expect(refused.headers.get('retry-after')).toBe('60');
    expect((await logIn(send, OWNER.email, OWNER.password)).status).toBe(200);
  });

  it('counts each account apart, so another account at the same address still gets through', async () => {
    const owner = await ownerCookie(api);
    const person = await invitePerson(send, owner);
    const change = (cookie: string, currentPassword: string) =>
      send('POST', '/api/password', cookie, { currentPassword, newPassword: NEW_PASSWORD });
    expect((await change(owner, 'guess one')).status).toBe(400);
    expect((await change(owner, 'guess two')).status).toBe(400);
    expect((await change(owner, OWNER.password)).status).toBe(429);
    expect((await change(person.cookie, 'guess one')).status).toBe(400);
    expect((await change(person.cookie, PERSON.password)).status).toBe(204);
  });
});
