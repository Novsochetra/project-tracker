import {
  DEFAULT_STATUSES,
  PROJECT_COLORS,
  type ErrorBody,
  type Project,
  type ProjectBoard,
  type ProjectDetail,
  type ProjectSummary,
} from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { imageForm, statusOf } from '../helpers/fixtures';
import { DIALECTS, useTestServer } from '../helpers/server';

describe.each(DIALECTS)('projects (%s)', (dialect) => {
  const api = useTestServer(dialect);

  it('creates a project with a derived prefix, palette color and the default statuses', async () => {
    const res = await api.post<ProjectDetail>('/api/projects', {
      name: 'Mobile app',
      description: 'Phone client',
      repo: '  ~/code/mobile  ',
    });
    expect(res.status).toBe(201);
    expect(res.body.project).toMatchObject({
      name: 'Mobile app',
      key: 'MA',
      description: 'Phone client',
      repo: '~/code/mobile',
      color: PROJECT_COLORS[0],
      nextNum: 1,
    });
    expect(res.body.project.createdAt).toBe(res.body.project.updatedAt);
    expect(res.body.statuses.map((s) => [s.name, s.category, s.color, s.position])).toEqual(
      DEFAULT_STATUSES.map((s, index) => [s.name, s.category, s.color, index]),
    );
    expect(api.events).toEqual([
      { type: 'changed', projectId: res.body.project.id, ticketId: null },
    ]);
  });

  it('cleans typed prefixes and keeps them unique', async () => {
    const client = api.client();
    const keys = [];
    keys.push((await client.createProject({ name: 'Website', key: ' we-b! ' })).project.key);
    keys.push((await client.createProject({ name: 'Web tools', key: 'web' })).project.key);
    keys.push((await client.createProject({ name: 'Website' })).project.key);
    keys.push((await client.createProject({ name: '!!!', key: '--' })).project.key);
    keys.push((await client.createProject({ name: 'Mobile', key: 'abcdefgh' })).project.key);
    keys.push((await client.createProject({ name: 'Other', key: 'ABCDE' })).project.key);
    expect(keys).toEqual(['WEB', 'WEB2', 'WEB3', 'PRJ', 'ABCDE', 'ABCD2']);
  });

  it('picks colors from the palette by project count', async () => {
    const client = api.client();
    const colors = [];
    for (let index = 0; index < 7; index++) {
      colors.push((await client.createProject({ name: `Project ${index}` })).project.color);
    }
    expect(colors).toEqual([...PROJECT_COLORS, PROJECT_COLORS[0]]);
  });

  it('rejects a blank name with the first validation message', async () => {
    const res = await api.post<ErrorBody>('/api/projects', { name: '   ' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: { code: 'invalid_input', message: 'Add a name to create the project.' },
    });
  });

  it('rejects malformed JSON as invalid input', async () => {
    const res = await api.request<ErrorBody>('POST', '/api/projects', {
      headers: { 'content-type': 'application/json' },
      body: undefined,
    });
    expect(res.status).toBe(400);
    const raw = await api.app.request('/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"name":',
    });
    expect(raw.status).toBe(400);
    expect(((await raw.json()) as ErrorBody).error.code).toBe('invalid_input');
  });

  it('lists projects in creation order with counts and last activity', async () => {
    const client = api.client();
    const first = await client.createProject({ name: 'First' });
    const second = await client.createProject({ name: 'Second' });
    const done = statusOf(first, 'done');
    await client.createTicket('FIR', { title: 'One' });
    await client.createTicket('FIR', { title: 'Two' });
    const last = await client.createTicket('FIR', { title: 'Three', statusId: done.id });

    const res = await api.get<ProjectSummary[]>('/api/projects');
    expect(res.status).toBe(200);
    expect(res.body.map((p) => p.key)).toEqual(['FIR', 'SEC']);
    expect(res.body[0]).toMatchObject({
      totalCount: 3,
      openCount: 2,
      doneCount: 1,
      lastActivityAt: last.updatedAt,
    });
    expect(res.body[1]).toMatchObject({
      totalCount: 0,
      openCount: 0,
      doneCount: 0,
      lastActivityAt: second.project.updatedAt,
    });
  });

  it('reads a project by key, case-insensitively', async () => {
    const created = await api.client().createProject({ name: 'Mobile app' });
    const res = await api.get<ProjectDetail>('/api/projects/ma');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(created);
  });

  it('answers 404 for an unknown project', async () => {
    for (const [method, path] of [
      ['GET', '/api/projects/NOPE'],
      ['PATCH', '/api/projects/NOPE'],
      ['DELETE', '/api/projects/NOPE'],
      ['GET', '/api/projects/NOPE/board'],
      ['GET', '/api/projects/NOPE/prompt'],
      ['GET', '/api/projects/NOPE/tickets'],
    ] as const) {
      const res = await api.request<ErrorBody>(method, path, {
        body: method === 'PATCH' ? {} : undefined,
      });
      expect(res.status, `${method} ${path}`).toBe(404);
      expect(res.body.error.code).toBe('not_found');
    }
  });

  it('edits name, description and repo but never the key', async () => {
    const created = await api.client().createProject({ name: 'Mobile app' });
    const res = await api.patch<Project>('/api/projects/MA', {
      name: ' Phone app ',
      description: 'New',
      repo: ' ~/code/phone ',
      key: 'XYZ',
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      name: 'Phone app',
      description: 'New',
      repo: '~/code/phone',
      key: 'MA',
    });
    expect(res.body.updatedAt).toBeGreaterThan(created.project.updatedAt);
    expect(api.events.at(-1)).toEqual({
      type: 'changed',
      projectId: created.project.id,
      ticketId: null,
    });
  });

  it('does not bump updatedAt when an edit changes nothing', async () => {
    const created = await api.client().createProject({ name: 'Mobile app' });
    const res = await api.patch<Project>('/api/projects/MA', { name: 'Mobile app' });
    expect(res.body.updatedAt).toBe(created.project.updatedAt);
  });

  it('deletes a project with its tickets, activity and image files', async () => {
    const client = api.client();
    await client.createProject({ name: 'Mobile app' });
    await client.createProject({ name: 'Keep me' });
    const ticket = await client.createTicket('MA', { title: 'Crash' });
    await api.post('/api/attachments', imageForm({ ticketKey: ticket.key }));
    const upload = await api.post<{ id: string }>('/api/attachments', imageForm());
    await client.addComment(ticket.key, { text: 'See image', attachmentIds: [upload.body.id] });
    expect(api.storage.files.size).toBe(2);

    const res = await api.delete('/api/projects/MA');
    expect(res.status).toBe(204);
    expect(res.body).toBeNull();
    expect((await api.get('/api/projects/MA')).status).toBe(404);
    expect((await api.get(`/api/tickets/${ticket.key}`)).status).toBe(404);
    expect(api.storage.files.size).toBe(0);
    for (const table of ['tickets', 'statuses', 'activities', 'attachments'] as const) {
      const rows = await api.db.selectFrom(table).select('id').execute();
      expect(rows.length, table).toBe(table === 'statuses' ? 5 : 0);
    }
    expect((await client.listProjects()).map((p) => p.key)).toEqual(['KM']);
  });

  it('returns the board with sorted statuses and counted ticket rows', async () => {
    const client = api.client();
    const project = await client.createProject({ name: 'Mobile app' });
    const done = statusOf(project, 'done');
    const a = await client.createTicket('MA', { title: 'A' });
    const b = await client.createTicket('MA', { title: 'B' });
    const c = await client.createTicket('MA', { title: 'C', statusId: done.id });
    await client.addComment(a.key, { text: 'one' });
    await client.addComment(a.key, { text: 'two' });
    await api.post('/api/attachments', imageForm({ ticketKey: a.key }));

    const res = await api.get<ProjectBoard>('/api/projects/MA/board');
    expect(res.status).toBe(200);
    expect(res.body.project.key).toBe('MA');
    expect(res.body.statuses.map((s) => s.name)).toEqual(DEFAULT_STATUSES.map((s) => s.name));
    expect(res.body.tickets.map((t) => t.key)).toEqual([b.key, a.key, c.key]);
    expect(res.body.tickets.find((t) => t.key === a.key)).toMatchObject({
      commentCount: 2,
      attachmentCount: 1,
    });
    expect(res.body.tickets.find((t) => t.key === b.key)).toMatchObject({
      commentCount: 0,
      attachmentCount: 0,
    });
  });
});
