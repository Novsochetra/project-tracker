import type { ErrorBody, Project, ProjectDetail } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { testClock } from '../helpers/auth';
import { agent } from '../helpers/fixtures';
import { addUser, caller, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

const REFUSED = {
  error: { code: 'forbidden', message: 'Only a person changes or deletes a project.' },
};

describe.each(DIALECTS)('who edits a project (%s)', (dialect) => {
  const clock = testClock();
  const api = useTestServer(dialect, { now: clock.now });
  let person: Caller;
  let helper: Caller;

  const project = async () => (await person<ProjectDetail>('GET', '/api/projects/BLOG')).body;

  beforeEach(async () => {
    clock.set(1_000_000);
    const owner = await addUser(api.db, 'owner@example.com', clock.now());
    person = caller(() => api.app, owner.person);
    helper = caller(() => api.app, owner.helper);
    await person('POST', '/api/projects', { name: 'Blog', key: 'BLOG', instructions: 'Plain.' });
  });

  it('refuses an agent token a project edit, before its body is read', async () => {
    const before = await project();
    const edit = await helper<ErrorBody>('PATCH', '/api/projects/BLOG', { instructions: 'Lie.' });
    expect(edit).toEqual({ status: 403, body: REFUSED });
    const malformed = await helper<ErrorBody>('PATCH', '/api/projects/BLOG', { name: 7 });
    expect(malformed.status).toBe(403);
    expect(await project()).toEqual(before);
  });

  it('refuses an agent token a project delete', async () => {
    const removed = await helper<ErrorBody>('DELETE', '/api/projects/BLOG');
    expect(removed).toEqual({ status: 403, body: REFUSED });
    expect((await project()).project.key).toBe('BLOG');
  });

  it('keeps reads open to agents', async () => {
    const read = await helper<ProjectDetail>('GET', '/api/projects/BLOG');
    expect(read.status).toBe(200);
    expect(read.body.project.instructions).toBe('Plain.');
    expect((await helper('GET', '/api/projects/BLOG/board')).status).toBe(200);
    expect((await helper('GET', '/api/projects')).status).toBe(200);
  });

  it('lets the person edit and delete', async () => {
    const edit = await person<Project>('PATCH', '/api/projects/BLOG', { instructions: 'Short.' });
    expect(edit.status).toBe(200);
    expect(edit.body.instructions).toBe('Short.');
    expect((await person('DELETE', '/api/projects/BLOG')).status).toBe(204);
  });
});

describe.each(DIALECTS)('who edits a project without an owner (%s)', (dialect) => {
  const api = useTestServer(dialect);

  it('refuses an agent that says so, and lets the person through', async () => {
    await api.client().createProject({ name: 'Blog', key: 'BLOG' });
    const claude = api.client(agent());
    await expect(claude.updateProject('BLOG', { name: 'Vlog' })).rejects.toMatchObject({
      status: 403,
    });
    await expect(claude.deleteProject('BLOG')).rejects.toMatchObject({ status: 403 });
    expect((await api.client().updateProject('BLOG', { name: 'Vlog' })).name).toBe('Vlog');
  });
});
