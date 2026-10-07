import type { ErrorBody, ProjectDetail, Status } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { agent, eventTexts, statusOf } from '../helpers/fixtures';
import { DIALECTS, useTestServer } from '../helpers/server';

describe.each(DIALECTS)('statuses (%s)', (dialect) => {
  const api = useTestServer(dialect);
  let project: ProjectDetail;

  beforeEach(async () => {
    project = await api.client().createProject({ name: 'Mobile app' });
    api.events.length = 0;
  });

  const statusNames = async () => (await api.client().getProject('MA')).statuses.map((s) => s.name);

  it('creates a status at the end with the category color by default', async () => {
    const res = await api.post<Status>('/api/projects/MA/statuses', {
      name: ' Blocked ',
      category: 'in_progress',
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: 'Blocked',
      category: 'in_progress',
      color: '#C26A06',
      position: 5,
      projectId: project.project.id,
    });
    const custom = await api
      .client()
      .createStatus('MA', { name: 'QA', category: 'in_review', color: '#C2298A' });
    expect(custom).toMatchObject({ color: '#C2298A', position: 6 });
    expect(await statusNames()).toEqual([
      'To do',
      'In progress',
      'Need review',
      'Reviewed',
      'Done',
      'Blocked',
      'QA',
    ]);
    expect(api.events).toContainEqual({
      type: 'changed',
      projectId: project.project.id,
      ticketId: null,
    });
  });

  it('keeps names unique per project, ignoring case', async () => {
    const res = await api.post<ErrorBody>('/api/projects/MA/statuses', {
      name: 'done',
      category: 'done',
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('conflict');
    const other = await api.client().createProject({ name: 'Other' });
    await expect(
      api.client().createStatus(other.project.key, { name: 'Blocked', category: 'todo' }),
    ).resolves.toBeDefined();
    await expect(
      api.client().createStatus('MA', { name: 'Blocked', category: 'todo' }),
    ).resolves.toBeDefined();
  });

  it('validates new statuses', async () => {
    const badColor = await api.post<ErrorBody>('/api/projects/MA/statuses', {
      name: 'x',
      category: 'todo',
      color: 'red',
    });
    expect(badColor.status).toBe(400);
    expect(badColor.body.error.message).toBe('Use a hex color like #5B5BD6');
    const badCategory = await api.post('/api/projects/MA/statuses', {
      name: 'x',
      category: 'later',
    });
    expect(badCategory.status).toBe(400);
  });

  it('renames, recolors and recategorizes a status', async () => {
    const todo = statusOf(project, 'todo');
    const res = await api.patch<Status>(`/api/statuses/${todo.id}`, {
      name: 'Backlog',
      color: '#6E56CF',
      category: 'in_progress',
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: todo.id,
      name: 'Backlog',
      color: '#6E56CF',
      category: 'in_progress',
      position: 0,
    });
    const same = await api.patch<Status>(`/api/statuses/${todo.id}`, { name: 'BACKLOG' });
    expect(same.status).toBe(200);
    const clash = await api.patch<ErrorBody>(`/api/statuses/${todo.id}`, { name: 'done' });
    expect(clash.status).toBe(409);
    expect((await api.patch(`/api/statuses/missing`, { name: 'x' })).status).toBe(404);
  });

  it('reorders statuses when given exactly the project status ids', async () => {
    const ids = project.statuses.map((s) => s.id).reverse();
    const res = await api.put<Status[]>('/api/projects/MA/statuses/order', { ids });
    expect(res.status).toBe(200);
    expect(res.body.map((s) => s.id)).toEqual(ids);
    expect(res.body.map((s) => s.position)).toEqual([0, 1, 2, 3, 4]);
    expect(await statusNames()).toEqual([
      'Done',
      'Reviewed',
      'Need review',
      'In progress',
      'To do',
    ]);
  });

  it('rejects a reorder with missing, extra or repeated ids', async () => {
    const ids = project.statuses.map((s) => s.id);
    const other = await api.client().createProject({ name: 'Other' });
    for (const bad of [
      ids.slice(1),
      [...ids, other.statuses[0]!.id],
      [...ids.slice(1), ids[1]!],
      [...ids.slice(1), other.statuses[0]!.id],
    ]) {
      const res = await api.put<ErrorBody>('/api/projects/MA/statuses/order', { ids: bad });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('invalid_input');
    }
  });

  it('deletes an empty status without a target', async () => {
    const reviewed = statusOf(project, 'reviewed');
    const res = await api.delete(`/api/statuses/${reviewed.id}`);
    expect(res.status).toBe(204);
    expect(await statusNames()).toEqual(['To do', 'In progress', 'Need review', 'Done']);
    expect((await api.delete(`/api/statuses/${reviewed.id}`)).status).toBe(404);
  });

  it('needs a target to delete a status with tickets and moves them to the end of it', async () => {
    const client = api.client();
    const todo = statusOf(project, 'todo');
    const doing = statusOf(project, 'in_progress');
    await client.createTicket('MA', { title: 'One', statusId: doing.id });
    await client.createTicket('MA', { title: 'Two' });
    await client.createTicket('MA', { title: 'Three' });

    const blocked = await api.delete<ErrorBody>(`/api/statuses/${todo.id}`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('conflict');
    const self = await api.delete<ErrorBody>(`/api/statuses/${todo.id}?moveTo=${todo.id}`);
    expect(self.status).toBe(400);

    const res = await api.delete(`/api/statuses/${todo.id}?moveTo=${doing.id}`);
    expect(res.status).toBe(204);
    const board = await client.getBoard('MA');
    expect(board.tickets.map((t) => [t.key, t.statusId])).toEqual([
      ['MA-1', doing.id],
      ['MA-3', doing.id],
      ['MA-2', doing.id],
    ]);
    expect(eventTexts(await client.getTicket('MA-2')).at(-1)).toBe('changed status to In progress');
    expect(eventTexts(await client.getTicket('MA-1'))).toEqual(['created the ticket']);
  });

  it('keeps at least one status', async () => {
    const client = api.client();
    const [last, ...rest] = project.statuses;
    for (const status of rest) await client.deleteStatus(status.id);
    const res = await api.delete<ErrorBody>(`/api/statuses/${last!.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('A project needs at least one status.');
  });

  it('does not let an agent move a deleted status’s tickets into Done', async () => {
    await api.client().createTicket('MA', { title: 'One' });
    const todo = statusOf(project, 'todo');
    const done = statusOf(project, 'done');
    const res = await api.delete<ErrorBody>(`/api/statuses/${todo.id}?moveTo=${done.id}`, {
      actor: agent(),
    });
    expect(res.status).toBe(403);
    expect(await statusNames()).toContain('To do');
  });
});
