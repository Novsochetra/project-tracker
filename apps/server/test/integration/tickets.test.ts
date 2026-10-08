import {
  formatShortDay,
  type ErrorBody,
  type ProjectDetail,
  type Ticket,
  type TicketDetail,
  type TicketListItem,
} from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { agent, eventTexts, imageUpload, statusOf } from '../helpers/fixtures';
import { DIALECTS, useTestServer } from '../helpers/server';

describe.each(DIALECTS)('tickets (%s)', (dialect) => {
  const api = useTestServer(dialect);
  let project: ProjectDetail;

  beforeEach(async () => {
    project = await api.client().createProject({ name: 'Mobile app' });
  });

  const ranks = async (statusId: string) => {
    const board = await api.client().getBoard('MA');
    return board.tickets.filter((t) => t.statusId === statusId).map((t) => t.key);
  };

  describe('create', () => {
    it('numbers tickets per project, defaults the fields and logs "created the ticket"', async () => {
      const res = await api.post<Ticket>('/api/projects/MA/tickets', {
        title: '  Crash on rotate  ',
      });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        key: 'MA-1',
        num: 1,
        projectId: project.project.id,
        statusId: statusOf(project, 'todo').id,
        title: 'Crash on rotate',
        description: '',
        priority: 'medium',
        assignee: '',
        due: '',
        rank: 0,
      });
      const detail = await api.client().getTicket('MA-1');
      expect(detail.activity).toMatchObject([
        { type: 'event', text: 'created the ticket', actor: { kind: 'human', name: '' } },
      ]);
      expect(detail.project.nextNum).toBe(2);
      expect(api.events).toContainEqual({
        type: 'changed',
        projectId: project.project.id,
        ticketId: res.body.id,
      });
    });

    it('puts new tickets at the top of their group', async () => {
      const client = api.client();
      await client.createTicket('MA', { title: 'First' });
      const second = await client.createTicket('MA', { title: 'Second' });
      expect(second.rank).toBe(-1000);
      expect(await ranks(second.statusId)).toEqual(['MA-2', 'MA-1']);
    });

    it('never reuses a number after a delete', async () => {
      const client = api.client();
      await client.createTicket('MA', { title: 'One' });
      await client.createTicket('MA', { title: 'Two' });
      await client.deleteTicket('MA-2');
      expect((await client.createTicket('MA', { title: 'Three' })).key).toBe('MA-3');
    });

    it('accepts a status, priority, assignee and due date', async () => {
      const doing = statusOf(project, 'in_progress');
      const ticket = await api.client().createTicket('MA', {
        title: 'Login',
        description: 'Steps',
        statusId: doing.id,
        priority: 'high',
        assignee: ' Dara ',
        due: '2026-10-09',
      });
      expect(ticket).toMatchObject({
        statusId: doing.id,
        description: 'Steps',
        priority: 'high',
        assignee: 'Dara',
        due: '2026-10-09',
      });
    });

    it('validates the input', async () => {
      const blank = await api.post<ErrorBody>('/api/projects/MA/tickets', { title: ' ' });
      expect(blank.status).toBe(400);
      expect(blank.body.error).toEqual({
        code: 'invalid_input',
        message: 'Add a title to create the ticket.',
      });
      const badDue = await api.post<ErrorBody>('/api/projects/MA/tickets', {
        title: 'x',
        due: 'soon',
      });
      expect(badDue.status).toBe(400);
      const otherStatus = await api.post<ErrorBody>('/api/projects/MA/tickets', {
        title: 'x',
        statusId: 'not-a-status',
      });
      expect(otherStatus.status).toBe(404);
      expect((await api.post('/api/projects/NOPE/tickets', { title: 'x' })).status).toBe(404);
    });

    it('links pending images to the new ticket', async () => {
      const upload = await api.upload(imageUpload());
      const ticket = await api.client().createTicket('MA', {
        title: 'With image',
        attachmentIds: [upload.body.id],
      });
      const detail = await api.client().getTicket(ticket.key);
      expect(detail.attachments).toMatchObject([
        { id: upload.body.id, ticketId: ticket.id, activityId: null, width: 3, height: 2 },
      ]);
    });

    it('rejects unknown image ids', async () => {
      const res = await api.post<ErrorBody>('/api/projects/MA/tickets', {
        title: 'x',
        attachmentIds: ['missing'],
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('invalid_input');
      expect((await api.client().getBoard('MA')).tickets).toHaveLength(0);
    });

    it('does not let an agent create a ticket in Done', async () => {
      const res = await api.post<ErrorBody>(
        '/api/projects/MA/tickets',
        { title: 'x', statusId: statusOf(project, 'done').id },
        { actor: agent() },
      );
      expect(res.status).toBe(403);
      expect(res.body.error).toEqual({
        code: 'forbidden',
        message: 'Only a person can move tickets to Done.',
      });
    });
  });

  describe('read', () => {
    it('returns the full ticket detail', async () => {
      const ticket = await api.client().createTicket('MA', { title: 'Crash' });
      const res = await api.get<TicketDetail>('/api/tickets/ma-1');
      expect(res.status).toBe(200);
      expect(res.body.ticket).toEqual(ticket);
      expect(res.body.project).toMatchObject({ key: 'MA', nextNum: 2 });
      expect(res.body.status).toEqual(statusOf(project, 'todo'));
      expect(res.body.statuses).toEqual(project.statuses);
      expect(res.body.attachments).toEqual([]);
    });

    it('answers 404 for unknown or malformed keys', async () => {
      for (const key of ['MA-9', 'NOPE-1', 'garbage', 'MA-0']) {
        const res = await api.get<ErrorBody>(`/api/tickets/${key}`);
        expect(res.status, key).toBe(404);
        expect(res.body.error.code).toBe('not_found');
      }
    });

    it('filters the ticket list by status name, category and search', async () => {
      const client = api.client();
      const doing = statusOf(project, 'in_progress');
      await client.createTicket('MA', { title: 'Login error' });
      await client.createTicket('MA', { title: 'Profile crash', statusId: doing.id });
      await client.createTicket('MA', { title: 'Login copy', statusId: doing.id });
      const keys = (items: TicketListItem[]) => items.map((t) => t.key);

      expect(keys(await client.listTickets('MA'))).toEqual(['MA-1', 'MA-3', 'MA-2']);
      expect(keys(await client.listTickets('MA', { status: 'in PROGRESS' }))).toEqual([
        'MA-3',
        'MA-2',
      ]);
      expect(keys(await client.listTickets('MA', { category: 'todo' }))).toEqual(['MA-1']);
      expect(keys(await client.listTickets('MA', { q: 'login' }))).toEqual(['MA-1', 'MA-3']);
      expect(keys(await client.listTickets('MA', { q: 'ma-2' }))).toEqual(['MA-2']);
      expect(keys(await client.listTickets('MA', { status: 'In progress', q: 'copy' }))).toEqual([
        'MA-3',
      ]);
      expect(keys(await client.listTickets('MA', { status: 'Nope' }))).toEqual([]);
      const bad = await api.get<ErrorBody>('/api/projects/MA/tickets?category=later');
      expect(bad.status).toBe(400);
    });
  });

  describe('update', () => {
    let ticket: Ticket;

    beforeEach(async () => {
      ticket = await api.client().createTicket('MA', { title: 'Crash' });
      api.events.length = 0;
    });

    const detail = () => api.client().getTicket(ticket.key);

    it('logs the events of SPEC §6.2 in field order', async () => {
      const done = statusOf(project, 'done');
      const res = await api.patch<Ticket>(`/api/tickets/${ticket.key}`, {
        statusId: done.id,
        priority: 'high',
        assignee: ' Dara ',
        due: '2026-10-09',
      });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        statusId: done.id,
        priority: 'high',
        assignee: 'Dara',
        due: '2026-10-09',
      });
      expect(eventTexts(await detail())).toEqual([
        'created the ticket',
        'changed status to Done',
        'set priority to High',
        'assigned the ticket to Dara',
        `set the due date to ${formatShortDay('2026-10-09')}`,
      ]);
      const stamps = (await detail()).activity.map((item) => item.createdAt);
      expect(stamps.slice(1)).toEqual([stamps[1], stamps[1]! + 1, stamps[1]! + 2, stamps[1]! + 3]);
      expect(api.events).toEqual([
        { type: 'changed', projectId: ticket.projectId, ticketId: ticket.id },
      ]);
    });

    it('logs removals of the assignee and due date', async () => {
      await api.client().updateTicket(ticket.key, { assignee: 'Dara', due: '2026-10-09' });
      await api.client().updateTicket(ticket.key, { assignee: '  ', due: '' });
      expect(eventTexts(await detail()).slice(-2)).toEqual([
        'removed the assignee',
        'removed the due date',
      ]);
    });

    it('logs nothing for title and description edits but bumps updatedAt', async () => {
      const res = await api
        .client()
        .updateTicket(ticket.key, { title: 'Crash on rotate', description: 'Rotate twice' });
      expect(res).toMatchObject({ title: 'Crash on rotate', description: 'Rotate twice' });
      expect(res.updatedAt).toBeGreaterThan(ticket.updatedAt);
      expect(eventTexts(await detail())).toEqual(['created the ticket']);
    });

    it('ignores values that did not change', async () => {
      const res = await api.client().updateTicket(ticket.key, {
        title: 'Crash',
        priority: 'medium',
        assignee: '',
        due: '',
        statusId: ticket.statusId,
      });
      expect(res.updatedAt).toBe(ticket.updatedAt);
      expect(eventTexts(await detail())).toEqual(['created the ticket']);
      expect(api.events).toEqual([]);
    });

    it('moves a ticket whose status changed to the top of the new group', async () => {
      const client = api.client();
      const doing = statusOf(project, 'in_progress');
      await client.createTicket('MA', { title: 'Two', statusId: doing.id });
      await client.createTicket('MA', { title: 'Three', statusId: doing.id });
      await client.updateTicket(ticket.key, { statusId: doing.id });
      expect(await ranks(doing.id)).toEqual(['MA-1', 'MA-3', 'MA-2']);
    });

    it('rejects a status from another project', async () => {
      const other = await api.client().createProject({ name: 'Other' });
      const res = await api.patch<ErrorBody>(`/api/tickets/${ticket.key}`, {
        statusId: statusOf(other, 'in_progress').id,
      });
      expect(res.status).toBe(404);
    });

    it('lets agents change fields but never set a Done status', async () => {
      const claude = api.client(agent('Claude'));
      await claude.updateTicket(ticket.key, { statusId: statusOf(project, 'in_review').id });
      await expect(
        claude.updateTicket(ticket.key, { statusId: statusOf(project, 'done').id }),
      ).rejects.toMatchObject({
        status: 403,
        code: 'forbidden',
        message: 'Only a person can move tickets to Done.',
      });
      const events = (await detail()).activity.filter((item) => item.type === 'event');
      expect(events.at(-1)).toMatchObject({
        text: 'changed status to Need review',
        actor: { kind: 'agent', name: 'Claude' },
      });
    });
  });

  describe('delete', () => {
    it('deletes the ticket, its activity and image files', async () => {
      const client = api.client();
      const ticket = await client.createTicket('MA', { title: 'Crash' });
      await api.upload(imageUpload({ ticketKey: ticket.key }));
      await client.addComment(ticket.key, { text: 'note' });
      const res = await api.delete(`/api/tickets/${ticket.key}`);
      expect(res.status).toBe(204);
      expect(api.storage.files.size).toBe(0);
      expect(await api.db.selectFrom('activities').select('id').execute()).toEqual([]);
      expect(await api.db.selectFrom('attachments').select('id').execute()).toEqual([]);
      expect((await api.delete(`/api/tickets/${ticket.key}`)).status).toBe(404);
    });
  });

  describe('move', () => {
    let todo: string;
    let doing: string;

    beforeEach(async () => {
      const client = api.client();
      todo = statusOf(project, 'todo').id;
      doing = statusOf(project, 'in_progress').id;
      for (const title of ['One', 'Two', 'Three']) await client.createTicket('MA', { title });
      await client.createTicket('MA', { title: 'Four', statusId: doing });
      api.events.length = 0;
    });

    it('reorders within a group and renumbers it', async () => {
      const ticket = await api
        .client()
        .moveTicket('MA-3', { statusId: todo, afterId: null, beforeId: null });
      expect(await ranks(todo)).toEqual(['MA-2', 'MA-1', 'MA-3']);
      const board = await api.client().getBoard('MA');
      expect(board.tickets.filter((t) => t.statusId === todo).map((t) => t.rank)).toEqual([
        0, 1000, 2000,
      ]);
      expect(ticket.rank).toBe(2000);
      expect(eventTexts(await api.client().getTicket('MA-3'))).toEqual(['created the ticket']);
    });

    it('moves across groups before a given ticket and logs the status change', async () => {
      const four = (await api.client().getTicket('MA-4')).ticket;
      const ticket = await api.client().moveTicket('MA-2', { statusId: doing, beforeId: four.id });
      expect(ticket.statusId).toBe(doing);
      expect(await ranks(doing)).toEqual(['MA-2', 'MA-4']);
      expect(eventTexts(await api.client().getTicket('MA-2')).at(-1)).toBe(
        'changed status to In progress',
      );
      expect(api.events).toEqual([
        { type: 'changed', projectId: project.project.id, ticketId: ticket.id },
      ]);
    });

    it('returns the ticket unchanged when the drop keeps the order', async () => {
      const client = api.client();
      const [one, two, three] = await Promise.all(
        ['MA-1', 'MA-2', 'MA-3'].map(async (key) => (await client.getTicket(key)).ticket),
      );
      const top = await api.post<Ticket>('/api/tickets/MA-3/move', {
        statusId: todo,
        beforeId: two!.id,
      });
      expect(top.status).toBe(200);
      expect(top.body).toEqual(three);
      const middle = await api.post<Ticket>('/api/tickets/MA-2/move', {
        statusId: todo,
        afterId: three!.id,
        beforeId: one!.id,
      });
      expect(middle.body).toEqual(two);
      expect(api.events).toEqual([]);
    });

    it('forbids agents from dropping into Done but allows other moves', async () => {
      const done = statusOf(project, 'done').id;
      const claude = api.client(agent());
      await expect(claude.moveTicket('MA-1', { statusId: done })).rejects.toMatchObject({
        status: 403,
      });
      await expect(claude.moveTicket('MA-1', { statusId: doing })).resolves.toMatchObject({
        statusId: doing,
      });
    });

    it('validates the target status', async () => {
      const res = await api.post<ErrorBody>('/api/tickets/MA-1/move', { statusId: 'nope' });
      expect(res.status).toBe(404);
      const missing = await api.post<ErrorBody>('/api/tickets/MA-1/move', {});
      expect(missing.status).toBe(400);
    });
  });
});
