import { randomUUID } from 'node:crypto';
import { RUNNER_TOOLS_MAX, type Runner } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { testClock } from '../helpers/auth';
import { addUser, caller, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

const TOOLS = { servers: ['GitHub', 'Notion'], commands: ['standup'], skills: ['report'] };

describe.each(DIALECTS)("a helper's tools (%s)", (dialect) => {
  const clock = testClock();
  const api = useTestServer(dialect, { now: clock.now });
  const runner = randomUUID();
  let person: Caller;
  let helper: Caller;

  const checkIn = (tools?: unknown) =>
    helper('PUT', `/api/runners/${runner}`, { name: 'Mac', projectKeys: ['MOB'], tools });
  const listed = async () => (await person<Runner[]>('GET', '/api/runners')).body[0]?.tools;

  beforeEach(async () => {
    clock.set(1_000_000);
    const owner = await addUser(api.db, 'owner@example.com', clock.now());
    person = caller(() => api.app, owner.person);
    helper = caller(() => api.app, owner.helper);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
  });

  it('keeps the tools of the latest check-in, and none from a helper that sends none', async () => {
    expect((await checkIn(TOOLS)).body).toMatchObject({ tools: TOOLS });
    expect(await listed()).toEqual(TOOLS);
    await checkIn({ servers: ['Gmail'], commands: [], skills: [] });
    expect(await listed()).toEqual({ servers: ['Gmail'], commands: [], skills: [] });
    await checkIn();
    expect(await listed()).toBeNull();
  });

  it('keeps names only, never anything else a helper sends', async () => {
    await checkIn({ ...TOOLS, urls: ['https://example.com/mcp?key=secret'] });
    const [row] = await api.db.selectFrom('runners').select('tools').execute();
    expect(row?.tools).not.toContain('secret');
    expect(await listed()).toEqual(TOOLS);
  });

  it('refuses a list past its bound and keeps what it had', async () => {
    await checkIn(TOOLS);
    const many = Array.from({ length: RUNNER_TOOLS_MAX + 1 }, (_, index) => `s${index}`);
    expect((await checkIn({ ...TOOLS, servers: many })).status).toBe(400);
    expect(await listed()).toEqual(TOOLS);
  });

  it('reads a broken stored value as no tools', async () => {
    await checkIn(TOOLS);
    await api.db.updateTable('runners').set({ tools: '{"servers":7}' }).execute();
    expect(await listed()).toBeNull();
  });
});
