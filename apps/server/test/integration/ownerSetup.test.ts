import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { FILE_NAME_HEADER } from '@tracker/shared';
import { afterAll, describe, expect, it } from 'vitest';
import { checkLogin } from '../../src/auth/login';
import { setOwner } from '../../src/auth/owner';
import { verifyPassword } from '../../src/auth/passwords';
import { createDatabase } from '../../src/db/createDatabase';
import { REPO_ROOT } from '../../src/config';
import { findOwner } from '../../src/repositories/users';
import { addOwner, CHEAP_SCRYPT, JSON_HEADERS, OWNER, signIn } from '../helpers/auth';
import { addUser } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

describe.each(DIALECTS)('owner setup (%s)', (dialect) => {
  const api = useTestServer(dialect);

  it('creates the one owner with a hashed password and a lower-case email', async () => {
    const result = await setOwner(
      api.db,
      { email: ' Owner@Example.com ', password: OWNER.password },
      5,
      CHEAP_SCRYPT,
    );
    expect(result).toEqual({ email: 'owner@example.com', created: true, signedOut: 0 });
    const rows = await api.db.selectFrom('users').selectAll().execute();
    expect(rows).toEqual([
      {
        id: expect.any(String),
        email: 'owner@example.com',
        passwordHash: expect.stringMatching(/^scrypt\$/),
        createdAt: 5,
        updatedAt: 5,
        name: '',
        role: 'owner',
      },
    ]);
    expect(rows[0]!.passwordHash).not.toContain(OWNER.password);
    expect(await verifyPassword(OWNER.password, rows[0]!.passwordHash)).toBe(true);
  });

  it('gives the projects and files made before it to the new owner', async () => {
    await api.post('/api/projects', { name: 'Mobile', key: 'MOB' });
    await api.app.request('/api/attachments', {
      method: 'POST',
      headers: { 'content-type': 'text/plain', [FILE_NAME_HEADER]: 'a.txt' },
      body: 'notes',
    });
    await addOwner(api.db);
    const owner = await findOwner(api.db);
    const projects = await api.db.selectFrom('projects').select('ownerId').execute();
    expect(projects).toEqual([{ ownerId: owner!.id }]);
    const files = await api.db.selectFrom('attachments').select('userId').execute();
    expect(files).toEqual([{ userId: owner!.id }]);
  });

  it('refuses an email another account already uses', async () => {
    await addOwner(api.db);
    await addUser(api.db, 'user@example.com', 2_000);
    await expect(
      setOwner(api.db, { email: 'user@example.com', password: OWNER.password }, 3, CHEAP_SCRYPT),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('replaces the email and password, signs out every device, and keeps API tokens', async () => {
    await addOwner(api.db);
    const cookie = await signIn(api.app);
    const created = await api.app.request('/api/tokens', {
      method: 'POST',
      headers: { ...JSON_HEADERS, cookie },
      body: JSON.stringify({ name: 'Claude laptop' }),
    });
    const { secret } = (await created.json()) as { secret: string };
    await signIn(api.app);

    const changed = { email: 'me@example.com', password: 'a brand new password' };
    expect(await setOwner(api.db, changed, 9, CHEAP_SCRYPT)).toEqual({
      email: 'me@example.com',
      created: false,
      signedOut: 2,
    });
    expect(await api.db.selectFrom('users').select('email').execute()).toEqual([
      { email: 'me@example.com' },
    ]);
    expect((await api.app.request('/api/projects', { headers: { cookie } })).status).toBe(401);
    const agent = { authorization: `Bearer ${secret}` };
    expect((await api.app.request('/api/projects', { headers: agent })).status).toBe(200);
    expect(await checkLogin(api.db, OWNER.email, OWNER.password)).toBeNull();
    expect(await checkLogin(api.db, changed.email, changed.password)).toMatchObject({
      email: 'me@example.com',
    });
  });

  it('asks for a real email and a password of at least 12 characters', async () => {
    await expect(
      setOwner(api.db, { email: 'not an email', password: OWNER.password }, 1, CHEAP_SCRYPT),
    ).rejects.toThrow('Use a real email address.');
    await expect(
      setOwner(api.db, { email: OWNER.email, password: 'short pass' }, 1, CHEAP_SCRYPT),
    ).rejects.toThrow('Use at least 12 characters for the password.');
    expect(await api.db.selectFrom('users').select('id').execute()).toEqual([]);
  });
});

describe('npm run owner:set', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tracker-owner-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  const run = (args: string[], password: string) => {
    const child = promisify(execFile)('npx', ['tsx', 'apps/server/src/cli/setOwner.ts', ...args], {
      cwd: REPO_ROOT,
      env: { ...process.env, DATABASE_URL: join(dir, 'tracker.db') },
    });
    child.child.stdin?.end(`${password}\nignored second line\n`);
    return child;
  };

  it('reads the password from a pipe and stores the owner in the database', async () => {
    const { stdout } = await run(['--email', 'Owner@Example.com'], OWNER.password);
    expect(stdout).toContain('Owner account created for owner@example.com.');
    const db = createDatabase(join(dir, 'tracker.db'));
    try {
      expect(await checkLogin(db, OWNER.email, OWNER.password)).not.toBeNull();
    } finally {
      await db.destroy();
    }
  });

  it('refuses a password given as an argument and a short password', async () => {
    await expect(run(['--email', 'a@b.co', '--password=hunter2'], '')).rejects.toMatchObject({
      stderr: expect.stringContaining('never pass it as an argument'),
    });
    await expect(run(['--email', 'a@b.co'], 'short')).rejects.toMatchObject({
      stderr: expect.stringContaining('at least 12 characters'),
    });
  });
});
