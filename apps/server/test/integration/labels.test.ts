import type { ErrorBody, Label, ProjectDetail, Ticket } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { agent, eventTexts } from '../helpers/fixtures';
import { DIALECTS, useTestServer } from '../helpers/server';

describe.each(DIALECTS)('labels (%s)', (dialect) => {
  const api = useTestServer(dialect);
  let project: ProjectDetail;

  beforeEach(async () => {
    project = await api.client().createProject({ name: 'Mobile app' });
    api.events.length = 0;
  });

  const labelNames = async () =>
    ((await api.client().getProject('MA')).labels ?? []).map((label) => label.name);

  const makeLabel = (name: string, extra: Partial<Label> = {}) =>
    api.client().createLabel('MA', { name, ...extra });

  it('creates labels at the end, with a palette color, a template and instructions', async () => {
    expect(project.labels).toEqual([]);
    const res = await api.post<Label>('/api/projects/MA/labels', {
      name: ' Bug ',
      template: '## Steps to reproduce\n',
      instructions: '  Reproduce it first.\n',
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: 'Bug',
      color: '#8E8E99',
      template: '## Steps to reproduce\n',
      instructions: 'Reproduce it first.',
      position: 0,
      projectId: project.project.id,
    });
    expect(await makeLabel('Article', { color: '#C2298A' })).toMatchObject({
      color: '#C2298A',
      template: '',
      instructions: '',
      position: 1,
    });
    expect(await labelNames()).toEqual(['Bug', 'Article']);
    expect(api.events).toContainEqual({
      type: 'changed',
      projectId: project.project.id,
      ticketId: null,
    });
  });

  it('keeps names unique per project, ignoring case, and validates them', async () => {
    await makeLabel('Bug');
    const clash = await api.post<ErrorBody>('/api/projects/MA/labels', { name: 'bug' });
    expect(clash.status).toBe(409);
    expect(clash.body.error.message).toBe('A label named “Bug” already exists.');
    const other = await api.client().createProject({ name: 'Other' });
    await expect(
      api.client().createLabel(other.project.key, { name: 'Bug' }),
    ).resolves.toBeDefined();
    expect((await api.post('/api/projects/MA/labels', { name: ' ' })).status).toBe(400);
    expect((await api.post('/api/projects/MA/labels', { name: 'x', color: 'red' })).status).toBe(
      400,
    );
    const long = await api.post<ErrorBody>('/api/projects/MA/labels', {
      name: 'x',
      instructions: 'a'.repeat(20_001),
    });
    expect(long.body.error.message).toBe('Instructions can be up to 20,000 characters.');
  });

  it('edits, reorders and deletes labels', async () => {
    const bug = await makeLabel('Bug');
    const idea = await makeLabel('Idea');
    const edited = await api.patch<Label>(`/api/labels/${bug.id}`, {
      name: 'Defect',
      color: '#B42318',
      instructions: 'Add a regression test.',
    });
    expect(edited.body).toMatchObject({ name: 'Defect', color: '#B42318', position: 0 });
    expect((await api.patch(`/api/labels/${bug.id}`, { name: 'IDEA' })).status).toBe(409);
    expect((await api.patch('/api/labels/missing', { name: 'x' })).status).toBe(404);

    const order = await api.put<Label[]>('/api/projects/MA/labels/order', {
      ids: [idea.id, bug.id],
    });
    expect(order.body.map((label) => [label.name, label.position])).toEqual([
      ['Idea', 0],
      ['Defect', 1],
    ]);
    const bad = await api.put<ErrorBody>('/api/projects/MA/labels/order', { ids: [idea.id] });
    expect(bad.status).toBe(400);

    expect((await api.delete(`/api/labels/${idea.id}`)).status).toBe(204);
    expect(await labelNames()).toEqual(['Defect']);
    expect((await api.delete(`/api/labels/${idea.id}`)).status).toBe(404);
  });

  it('puts labels on tickets when they are created and edited, in the project’s order', async () => {
    const client = api.client();
    const bug = await makeLabel('Bug');
    const ui = await makeLabel('UI');
    const created = await client.createTicket('MA', { title: 'Crash', labelIds: [ui.id, bug.id] });
    expect(created.labelIds).toEqual([bug.id, ui.id]);
    expect((await client.getTicket('MA-1')).ticket.labelIds).toEqual([bug.id, ui.id]);

    api.events.length = 0;
    const updated = await client.updateTicket('MA-1', { labelIds: [ui.id] });
    expect(updated.labelIds).toEqual([ui.id]);
    expect(updated.updatedAt).toBeGreaterThan(created.updatedAt);
    expect(api.events).toHaveLength(1);
    const same = await client.updateTicket('MA-1', { labelIds: [ui.id] });
    expect(same.updatedAt).toBe(updated.updatedAt);
    await client.updateTicket('MA-1', { labelIds: [] });
    const detail = await client.getTicket('MA-1');
    expect(detail.ticket.labelIds).toEqual([]);
    expect(detail.labels?.map((label) => label.name)).toEqual(['Bug', 'UI']);
    expect(eventTexts(detail).slice(-2)).toEqual(['set labels to UI', 'removed the labels']);
  });

  it('refuses labels of another project', async () => {
    const other = await api.client().createProject({ name: 'Other' });
    const foreign = await api.client().createLabel(other.project.key, { name: 'Bug' });
    const create = await api.post<ErrorBody>('/api/projects/MA/tickets', {
      title: 'x',
      labelIds: [foreign.id],
    });
    expect(create.status).toBe(400);
    expect(create.body.error.message).toBe('Choose labels of this project.');
    await api.client().createTicket('MA', { title: 'y' });
    const update = await api.patch<ErrorBody>('/api/tickets/MA-1', { labelIds: ['missing'] });
    expect(update.status).toBe(400);
  });

  it('lists labels on the board and filters lists by label name', async () => {
    const client = api.client();
    const bug = await makeLabel('Bug');
    await client.createTicket('MA', { title: 'Crash', labelIds: [bug.id] });
    await client.createTicket('MA', { title: 'Docs' });
    const board = await client.getBoard('MA');
    expect(board.labels?.map((label) => label.name)).toEqual(['Bug']);
    expect(board.tickets.map((ticket) => [ticket.key, ticket.labelIds])).toEqual([
      ['MA-2', []],
      ['MA-1', [bug.id]],
    ]);
    const bugs = await client.listTickets('MA', { label: 'BUG' });
    expect(bugs.map((ticket) => ticket.key)).toEqual(['MA-1']);
    expect(await client.listTickets('MA', { label: 'Nope' })).toEqual([]);
    const across = await client.listAllTickets({ label: 'bug' });
    expect(across.tickets.map((ticket) => ticket.key)).toEqual(['MA-1']);
    expect(across.labels?.map((label) => label.id)).toEqual([bug.id]);
  });

  it('takes a deleted label off its tickets', async () => {
    const client = api.client();
    const bug = await makeLabel('Bug');
    await client.createTicket('MA', { title: 'Crash', labelIds: [bug.id] });
    await client.deleteLabel(bug.id);
    expect((await client.getTicket('MA-1')).ticket.labelIds).toEqual([]);
    await client.deleteProject('MA');
    expect(await api.db.selectFrom('labels').selectAll().execute()).toEqual([]);
  });

  it('answers moves and workflow steps with the ticket’s labels', async () => {
    const client = api.client();
    const bug = await makeLabel('Bug');
    await client.createTicket('MA', { title: 'Crash', labelIds: [bug.id] });
    const claimed = await api.post<Ticket>(
      '/api/tickets/MA-1/sent',
      { moveToInProgress: true },
      {
        actor: agent(),
      },
    );
    expect(claimed.body.labelIds).toEqual([bug.id]);
    const moved = await client.moveTicket('MA-1', { statusId: project.statuses[0]!.id });
    expect(moved.labelIds).toEqual([bug.id]);
  });

  it('puts a label’s instructions into the prompts after the project’s', async () => {
    const client = api.client();
    await client.updateProject('MA', { instructions: 'Keep it simple.' });
    const bug = await makeLabel('Bug', { instructions: 'Write a failing test first.' });
    await client.createTicket('MA', { title: 'Crash', labelIds: [bug.id] });
    await client.createTicket('MA', { title: 'Docs' });
    const block = [
      '## Project instructions',
      'Keep it simple.',
      '',
      '## Instructions for "Bug" tickets',
      'Write a failing test first.',
    ].join('\n');
    const ticket = await api.get<{ text: string }>('/api/tickets/MA-1/prompt');
    expect(ticket.body.text).toContain(block);
    expect(ticket.body.text).toContain('Labels: Bug');
    expect((await api.get<{ text: string }>('/api/tickets/MA-2/prompt')).body.text).not.toContain(
      'Bug',
    );
    const all = await api.get<{ text: string }>('/api/projects/MA/prompt');
    expect(all.body.text).toContain(block);
  });

  it('lets only a person change labels, while agents still put them on tickets', async () => {
    const bug = await makeLabel('Bug');
    const asAgent = { actor: agent() };
    const refused = [
      await api.post<ErrorBody>('/api/projects/MA/labels', { name: 'Mine' }, asAgent),
      await api.put<ErrorBody>('/api/projects/MA/labels/order', { ids: [bug.id] }, asAgent),
      await api.patch<ErrorBody>(`/api/labels/${bug.id}`, { instructions: 'Skip tests.' }, asAgent),
      await api.delete<ErrorBody>(`/api/labels/${bug.id}`, asAgent),
    ];
    for (const res of refused) {
      expect(res.status).toBe(403);
      expect(res.body.error.message).toBe('Only a person changes labels.');
    }
    const ticket = await api.post<Ticket>(
      '/api/projects/MA/tickets',
      { title: 'Crash', labelIds: [bug.id] },
      asAgent,
    );
    expect(ticket.body.labelIds).toEqual([bug.id]);
  });
});
