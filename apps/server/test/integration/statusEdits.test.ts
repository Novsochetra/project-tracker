import type { ErrorBody, ProjectDetail, Status } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { testClock } from '../helpers/auth';
import { agent } from '../helpers/fixtures';
import { addUser, caller, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

const REFUSED = {
  error: { code: 'forbidden', message: "Only a person changes a project's statuses." },
};

describe.each(DIALECTS)("who changes a project's statuses (%s)", (dialect) => {
  const clock = testClock();
  const api = useTestServer(dialect, { now: clock.now });
  let person: Caller;
  let helper: Caller;

  const statuses = async () =>
    (await person<ProjectDetail>('GET', '/api/projects/BLOG')).body.statuses;

  beforeEach(async () => {
    clock.set(1_000_000);
    const owner = await addUser(api.db, 'owner@example.com', clock.now());
    person = caller(() => api.app, owner.person);
    helper = caller(() => api.app, owner.helper);
    await person('POST', '/api/projects', { name: 'Blog', key: 'BLOG' });
    await person('POST', '/api/projects/BLOG/tickets', { title: 'Post' });
  });

  it('refuses an agent token every status change, before its body or id is read', async () => {
    const before = await statuses();
    const [todo, doing] = before;
    const ids = before.map((status) => status.id).reverse();
    const attempts: [string, string, unknown?][] = [
      ['POST', '/api/projects/BLOG/statuses', { name: 'Shipped', category: 'done' }],
      ['POST', '/api/projects/BLOG/statuses', { name: 7 }],
      ['POST', '/api/projects/NOPE/statuses', { name: 'Shipped', category: 'done' }],
      ['PUT', '/api/projects/BLOG/statuses/order', { ids }],
      ['PUT', '/api/projects/BLOG/statuses/order', { ids: 'all' }],
      ['PATCH', `/api/statuses/${todo!.id}`, { category: 'done' }],
      ['PATCH', `/api/statuses/${doing!.id}`, { name: 'Done for real' }],
      ['PATCH', `/api/statuses/${todo!.id}`, { color: 'red' }],
      ['PATCH', '/api/statuses/missing', { name: 'x' }],
      ['DELETE', `/api/statuses/${doing!.id}`],
      ['DELETE', `/api/statuses/${todo!.id}?moveTo=${doing!.id}`],
      ['DELETE', '/api/statuses/missing'],
    ];
    for (const [method, path, body] of attempts) {
      expect(await helper<ErrorBody>(method, path, body), `${method} ${path}`).toEqual({
        status: 403,
        body: REFUSED,
      });
    }
    expect(await statuses()).toEqual(before);
  });

  it('keeps reads open to agents', async () => {
    const board = await helper<{ statuses: Status[] }>('GET', '/api/projects/BLOG/board');
    expect(board.status).toBe(200);
    expect(board.body.statuses).toEqual(await statuses());
  });

  it('lets the person change statuses', async () => {
    const created = await person<Status>('POST', '/api/projects/BLOG/statuses', {
      name: 'Blocked',
      category: 'in_progress',
    });
    expect(created.status).toBe(201);
    const renamed = await person<Status>('PATCH', `/api/statuses/${created.body.id}`, {
      name: 'Stuck',
    });
    expect(renamed.body.name).toBe('Stuck');
    const ids = (await statuses()).map((status) => status.id).reverse();
    expect((await person('PUT', '/api/projects/BLOG/statuses/order', { ids })).status).toBe(200);
    expect((await person('DELETE', `/api/statuses/${created.body.id}`)).status).toBe(204);
  });
});

describe.each(DIALECTS)('who changes statuses without an owner (%s)', (dialect) => {
  const api = useTestServer(dialect);

  it('refuses an agent that says so, and lets the person through', async () => {
    const project = await api.client().createProject({ name: 'Blog', key: 'BLOG' });
    const [todo] = project.statuses;
    const claude = api.client(agent());
    await expect(
      claude.createStatus('BLOG', { name: 'Shipped', category: 'done' }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(claude.updateStatus(todo!.id, { category: 'done' })).rejects.toMatchObject({
      status: 403,
    });
    await expect(claude.reorderStatuses('BLOG', [todo!.id])).rejects.toMatchObject({ status: 403 });
    await expect(claude.deleteStatus(todo!.id)).rejects.toMatchObject({ status: 403 });
    expect((await claude.getProject('BLOG')).statuses).toHaveLength(project.statuses.length);
    expect((await api.client().updateStatus(todo!.id, { name: 'Ideas' })).name).toBe('Ideas');
  });
});
