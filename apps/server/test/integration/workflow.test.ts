import { ApiError } from '@tracker/client';
import type { ErrorBody, ProjectDetail, TicketDetail } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { agent, eventTexts, statusOf } from '../helpers/fixtures';
import { DIALECTS, useTestServer } from '../helpers/server';

describe.each(DIALECTS)('agent workflow (%s)', (dialect) => {
  const api = useTestServer(dialect);
  let project: ProjectDetail;
  const worker = agent('Worker');

  beforeEach(async () => {
    project = await api.client().createProject({ name: 'Mobile app' });
  });

  const keysIn = async (category: Parameters<typeof statusOf>[1]) => {
    const statusId = statusOf(project, category).id;
    return (await api.client().getBoard('MA')).tickets
      .filter((t) => t.statusId === statusId)
      .map((t) => t.key);
  };

  describe('claiming', () => {
    it('claims the next To do ticket by priority, then order, then number', async () => {
      const client = api.client();
      await client.createTicket('MA', { title: 'Low', priority: 'low' });
      await client.createTicket('MA', { title: 'High one', priority: 'high' });
      await client.createTicket('MA', { title: 'High two', priority: 'high' });
      await client.createTicket('MA', {
        title: 'Busy',
        statusId: statusOf(project, 'in_progress').id,
        priority: 'high',
      });

      const res = await api.post<TicketDetail>('/api/projects/MA/claim', undefined, {
        actor: worker,
      });
      expect(res.status).toBe(200);
      expect(res.body.ticket).toMatchObject({ key: 'MA-3', assignee: 'Worker' });
      expect(res.body.status.category).toBe('in_progress');
      expect(res.body.activity.at(-1)).toMatchObject({
        type: 'event',
        text: 'picked up the ticket and moved it to In progress',
        actor: { kind: 'agent', name: 'Worker' },
      });
      expect(await keysIn('in_progress')).toEqual(['MA-3', 'MA-4']);
      expect((await api.client(worker).claimNext('MA'))?.ticket.key).toBe('MA-2');
      expect((await api.client(worker).claimNext('MA'))?.ticket.key).toBe('MA-1');
    });

    it('answers 204 when nothing is waiting', async () => {
      await api
        .client()
        .createTicket('MA', { title: 'Busy', statusId: statusOf(project, 'in_progress').id });
      const res = await api.post('/api/projects/MA/claim', undefined, { actor: worker });
      expect(res.status).toBe(204);
      expect(res.body).toBeNull();
      expect(await api.client(worker).claimNext('MA')).toBeNull();
      expect((await api.post('/api/projects/NOPE/claim')).status).toBe(404);
    });

    it('keeps an existing assignee and does not assign people who claim', async () => {
      const client = api.client();
      await client.createTicket('MA', { title: 'Owned', assignee: 'Dara' });
      await client.createTicket('MA', { title: 'Free' });
      expect((await api.client(worker).claimTicket('MA-1')).ticket.assignee).toBe('Dara');
      expect((await client.claimTicket('MA-2')).ticket.assignee).toBe('');
    });

    it('picks up an In progress ticket without moving it', async () => {
      const doing = statusOf(project, 'in_progress').id;
      const ticket = await api.client().createTicket('MA', { title: 'Busy', statusId: doing });
      const detail = await api.client(worker).claimTicket(ticket.key);
      expect(detail.ticket).toMatchObject({ statusId: doing, rank: ticket.rank });
      expect(eventTexts(detail).at(-1)).toBe('picked up the ticket');
    });

    it('refuses tickets that are waiting for review, reviewed or done', async () => {
      const client = api.client();
      for (const category of ['in_review', 'reviewed', 'done'] as const) {
        const ticket = await client.createTicket('MA', {
          title: category,
          statusId: statusOf(project, category).id,
        });
        const res = await api.post<ErrorBody>(`/api/tickets/${ticket.key}/claim`, undefined, {
          actor: worker,
        });
        expect(res.status, category).toBe(409);
        expect(res.body.error.code).toBe('conflict');
      }
      expect((await api.post('/api/tickets/MA-99/claim')).status).toBe(404);
    });
  });

  describe('submitting', () => {
    it('stores a report card and moves the ticket to the top of Need review', async () => {
      const client = api.client();
      await client.createTicket('MA', {
        title: 'Waiting',
        statusId: statusOf(project, 'in_review').id,
      });
      const ticket = await client.createTicket('MA', { title: 'Work' });
      await api.client(worker).claimTicket(ticket.key);

      const res = await api.post<TicketDetail>(
        `/api/tickets/${ticket.key}/submit`,
        { summary: ' Fixed the crash. ', files: 'src/a.ts\nsrc/b.ts', next: '' },
        { actor: worker },
      );
      expect(res.status).toBe(200);
      expect(res.body.status.name).toBe('Need review');
      expect(res.body.activity.slice(-2)).toMatchObject([
        {
          type: 'report',
          text: 'TICKET: MA-2\nSTATUS: done\nSUMMARY: Fixed the crash.\nFILES: src/a.ts\nsrc/b.ts\nNEXT: none',
          actor: { kind: 'agent', name: 'Worker' },
        },
        { type: 'event', text: 'submitted the work and moved it to Need review' },
      ]);
      expect(await keysIn('in_review')).toEqual(['MA-2', 'MA-1']);
    });

    it('validates the summary', async () => {
      await api.client().createTicket('MA', { title: 'Work' });
      const res = await api.post<ErrorBody>(
        '/api/tickets/MA-1/submit',
        { summary: '  ' },
        { actor: worker },
      );
      expect(res.status).toBe(400);
      expect((await api.post('/api/tickets/MA-2/submit', { summary: 'x' })).status).toBe(404);
    });
  });

  describe('reviewing', () => {
    beforeEach(async () => {
      await api
        .client()
        .createTicket('MA', { title: 'Work', statusId: statusOf(project, 'in_review').id });
    });

    it('approves into Reviewed with a rated review card', async () => {
      const reviewer = api.client(agent('Reviewer'));
      const detail = await reviewer.reviewTicket('MA-1', {
        verdict: 'approved',
        rating: 5,
        summary: ' Solid. ',
      });
      expect(detail.status.name).toBe('Reviewed');
      expect(detail.activity.slice(-2)).toMatchObject([
        {
          type: 'review',
          text: 'Solid.',
          review: { verdict: 'approved', rating: 5 },
          actor: { name: 'Reviewer' },
        },
        { type: 'event', text: 'approved the work and moved it to Reviewed' },
      ]);
    });

    it('sends requested changes to the top of To do', async () => {
      await api.client().createTicket('MA', { title: 'Queued' });
      const detail = await api.client(agent('Reviewer')).reviewTicket('MA-1', {
        verdict: 'changes_requested',
        rating: 2,
        summary: 'Add a test.',
      });
      expect(detail.status.name).toBe('To do');
      expect(eventTexts(detail).at(-1)).toBe('requested changes and moved it to To do');
      expect(await keysIn('todo')).toEqual(['MA-1', 'MA-2']);
      expect((await api.client(worker).claimNext('MA'))?.ticket.key).toBe('MA-1');
    });

    it('only reviews tickets that wait for review', async () => {
      const review = { verdict: 'approved', rating: 3, summary: 'ok' };
      await api.client().createTicket('MA', { title: 'Todo' });
      const res = await api.post<ErrorBody>('/api/tickets/MA-2/review', review, { actor: worker });
      expect(res.status).toBe(409);
      for (const bad of [
        { ...review, rating: 0 },
        { ...review, rating: 6 },
        { ...review, rating: 2.5 },
        { ...review, verdict: 'meh' },
      ]) {
        expect((await api.post('/api/tickets/MA-1/review', bad)).status).toBe(400);
      }
    });

    it('never approves an agent’s work straight into Done', async () => {
      const client = api.client();
      await client.deleteStatus(statusOf(project, 'reviewed').id);
      const detail = await api.client(agent('Reviewer')).reviewTicket('MA-1', {
        verdict: 'approved',
        rating: 4,
        summary: 'ok',
      });
      expect(detail.status.name).toBe('Need review');
      expect(eventTexts(detail).at(-1)).toBe('approved the work');
    });
  });

  it('runs the full loop: claim, comment, submit, changes, claim, submit, approve, Done', async () => {
    const person = api.client();
    const workerClient = api.client(agent('Worker'));
    const reviewer = api.client(agent('Reviewer'));
    await person.createTicket('MA', { title: 'Crash on rotate', priority: 'high' });

    const claimed = await workerClient.claimNext('MA');
    expect(claimed?.status.category).toBe('in_progress');
    await workerClient.addComment('MA-1', { text: 'Found the cause.' });
    expect(
      (await workerClient.submitForReview('MA-1', { summary: 'Fixed.' })).status.category,
    ).toBe('in_review');

    const changes = await reviewer.reviewTicket('MA-1', {
      verdict: 'changes_requested',
      rating: 2,
      summary: 'Add a test.',
    });
    expect(changes.status.category).toBe('todo');
    expect(changes.ticket.rank).toBe(
      Math.min(...(await person.getBoard('MA')).tickets.map((t) => t.rank)),
    );

    expect((await workerClient.claimNext('MA'))?.ticket.key).toBe('MA-1');
    await workerClient.submitForReview('MA-1', {
      summary: 'Added the test.',
      files: 'test/a.test.ts',
    });
    const approved = await reviewer.reviewTicket('MA-1', {
      verdict: 'approved',
      rating: 4,
      summary: 'Good.',
    });
    expect(approved.status.name).toBe('Reviewed');

    const done = statusOf(project, 'done').id;
    const attempt = workerClient.updateTicket('MA-1', { statusId: done });
    await expect(attempt).rejects.toBeInstanceOf(ApiError);
    await expect(attempt).rejects.toMatchObject({ status: 403, code: 'forbidden' });
    const final = await person.updateTicket('MA-1', { statusId: done });
    expect(final.statusId).toBe(done);

    const detail = await person.getTicket('MA-1');
    expect(
      detail.activity.map(
        (item) => `${item.actor.name || 'You'}: ${item.type} ${item.text.split('\n')[0]}`,
      ),
    ).toEqual([
      'You: event created the ticket',
      'Worker: event picked up the ticket and moved it to In progress',
      'Worker: comment Found the cause.',
      'Worker: report TICKET: MA-1',
      'Worker: event submitted the work and moved it to Need review',
      'Reviewer: review Add a test.',
      'Reviewer: event requested changes and moved it to To do',
      'Worker: event picked up the ticket and moved it to In progress',
      'Worker: report TICKET: MA-1',
      'Worker: event submitted the work and moved it to Need review',
      'Reviewer: review Good.',
      'Reviewer: event approved the work and moved it to Reviewed',
      'You: event changed status to Done',
    ]);
  });
});
