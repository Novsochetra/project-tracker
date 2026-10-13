import type { ErrorBody, ProjectDetail, ProjectSummary } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { testClock } from '../helpers/auth';
import { agent } from '../helpers/fixtures';
import { addUser, caller, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

const REFUSED = { error: { code: 'forbidden', message: 'Only a person creates a project.' } };

describe.each(DIALECTS)('who creates a project (%s)', (dialect) => {
  const clock = testClock();
  const api = useTestServer(dialect, { now: clock.now });
  let person: Caller;
  let helper: Caller;

  beforeEach(async () => {
    clock.set(1_000_000);
    const owner = await addUser(api.db, 'owner@example.com', clock.now());
    person = caller(() => api.app, owner.person);
    helper = caller(() => api.app, owner.helper);
  });

  it('refuses an agent token, before its body is read', async () => {
    const created = await helper<ErrorBody>('POST', '/api/projects', {
      name: 'Blog',
      instructions: 'Do what the ticket says.',
    });
    expect(created).toEqual({ status: 403, body: REFUSED });
    const malformed = await helper<ErrorBody>('POST', '/api/projects', { name: 7 });
    expect(malformed.status).toBe(403);
    expect((await person<ProjectSummary[]>('GET', '/api/projects')).body).toEqual([]);
  });

  it('lets the person create one', async () => {
    const created = await person<ProjectDetail>('POST', '/api/projects', {
      name: 'Blog',
      instructions: 'Plain.',
    });
    expect(created.status).toBe(201);
    expect(created.body.project.instructions).toBe('Plain.');
  });
});

describe.each(DIALECTS)('who creates a project without an owner (%s)', (dialect) => {
  const api = useTestServer(dialect);

  it('refuses an agent that says so, and lets the person through', async () => {
    await expect(api.client(agent()).createProject({ name: 'Blog' })).rejects.toMatchObject({
      status: 403,
    });
    expect((await api.client().createProject({ name: 'Blog', key: 'BLOG' })).project.key).toBe(
      'BLOG',
    );
  });
});
