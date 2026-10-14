import {
  buildProjectPrompt,
  buildReviewPrompt,
  buildTicketPrompt,
  type ProjectDetail,
  type PromptResult,
  type Ticket,
} from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { agent, eventTexts, imageUpload, statusOf } from '../helpers/fixtures';
import { DIALECTS, useTestServer } from '../helpers/server';

describe.each(DIALECTS)('prompts and sending (%s)', (dialect) => {
  const api = useTestServer(dialect);
  let project: ProjectDetail;

  beforeEach(async () => {
    project = await api.client().createProject({ name: 'Mobile app', repo: '~/code/mobile' });
  });

  const promptProject = { name: 'Mobile app', key: 'MA', repo: '~/code/mobile', maxSubAgents: 3 };

  describe('ticket prompt', () => {
    it('includes notes, the last report and the last review', async () => {
      const client = api.client();
      const ticket = await client.createTicket('MA', {
        title: 'Crash on rotate',
        description: 'Rotate twice.',
        priority: 'high',
        assignee: 'Dara',
        due: '2026-10-09',
      });
      const image = (await api.upload(imageUpload())).body;
      await client.addComment(ticket.key, { text: 'First note\nwith a break' });
      await client.addComment(ticket.key, { attachmentIds: [image.id] });
      await client.applyReport({ text: 'TICKET: MA-1\nSTATUS: in progress\nSUMMARY: started' });
      await client.submitForReview(ticket.key, { summary: 'Fixed it', files: 'src/a.ts' });
      await client.reviewTicket(ticket.key, {
        verdict: 'changes_requested',
        rating: 2,
        summary: 'Add a test',
      });
      await client.addComment(ticket.key, { text: 'Second note' });

      const res = await api.get<PromptResult>('/api/tickets/MA-1/prompt');
      expect(res.status).toBe(200);
      expect(res.body.ticketCount).toBe(1);
      expect(res.body.role).toBe('work');
      expect(res.body.text).toBe(
        buildTicketPrompt(promptProject, {
          key: 'MA-1',
          title: 'Crash on rotate',
          description: 'Rotate twice.',
          priority: 'high',
          statusName: 'To do',
          due: '2026-10-09',
          assignee: 'Dara',
          notes: ['First note\nwith a break', 'Second note'],
          lastReport: 'TICKET: MA-1\nSTATUS: done\nSUMMARY: Fixed it\nFILES: src/a.ts\nNEXT: none',
          lastReview: { verdict: 'changes_requested', rating: 2, text: 'Add a test' },
        }),
      );
      expect(res.body.text).toContain('Last review: Changes requested · 2/5');
      expect(res.body.text).toContain('- First note with a break');
    });

    it('asks for a review of a ticket in review, with the worker’s report', async () => {
      const client = api.client();
      const ticket = await client.createTicket('MA', { title: 'Crash on rotate' });
      await client.submitForReview(ticket.key, { summary: 'Fixed it', files: 'src/a.ts' });

      const res = await api.get<PromptResult>('/api/tickets/MA-1/prompt');
      expect(res.body).toEqual({
        text: buildReviewPrompt(promptProject, {
          key: 'MA-1',
          title: 'Crash on rotate',
          description: '',
          priority: 'medium',
          statusName: 'Need review',
          due: '',
          assignee: '',
          notes: [],
          lastReport: 'TICKET: MA-1\nSTATUS: done\nSUMMARY: Fixed it\nFILES: src/a.ts\nNEXT: none',
          lastReview: null,
        }),
        ticketCount: 1,
        role: 'review',
      });
    });

    it('goes by the status category, so a renamed review status still asks for a review', async () => {
      const client = api.client();
      await client.updateStatus(statusOf(project, 'in_review').id, { name: 'QA' });
      await client.createTicket('MA', {
        title: 'Check me',
        statusId: statusOf(project, 'in_review').id,
      });
      await client.createTicket('MA', {
        title: 'Approved',
        statusId: statusOf(project, 'reviewed').id,
      });

      const review = await api.get<PromptResult>('/api/tickets/MA-1/prompt');
      expect(review.body.role).toBe('review');
      expect(review.body.text).toContain('Please review the work on ticket MA-1');
      const reviewed = await api.get<PromptResult>('/api/tickets/MA-2/prompt');
      expect(reviewed.body.role).toBe('work');
      expect(reviewed.body.text).toContain('Please work on ticket MA-2');
    });

    it('answers 404 for an unknown ticket', async () => {
      expect((await api.get('/api/tickets/MA-1/prompt')).status).toBe(404);
    });
  });

  describe('project prompt', () => {
    it('lists open work: in progress first, then priority, then number', async () => {
      const client = api.client();
      const doing = statusOf(project, 'in_progress').id;
      await client.createTicket('MA', { title: 'Low todo', priority: 'low' });
      await client.createTicket('MA', { title: 'High todo', priority: 'high' });
      await client.createTicket('MA', { title: 'Doing', statusId: doing, priority: 'low' });
      await client.createTicket('MA', {
        title: 'Review',
        statusId: statusOf(project, 'in_review').id,
      });
      await client.createTicket('MA', { title: 'Done', statusId: statusOf(project, 'done').id });
      await client.addComment('MA-1', { text: 'note on low' });

      const res = await api.get<PromptResult>('/api/projects/MA/prompt');
      expect(res.body.ticketCount).toBe(3);
      expect(res.body.role).toBe('work');
      const block = (
        key: string,
        title: string,
        priority: Ticket['priority'],
        statusName: string,
      ) => ({
        key,
        title,
        description: '',
        priority,
        statusName,
        due: '',
        assignee: '',
        notes: key === 'MA-1' ? ['note on low'] : [],
        lastReport: null,
        lastReview: null,
      });
      expect(res.body.text).toBe(
        buildProjectPrompt(promptProject, [
          block('MA-3', 'Doing', 'low', 'In progress'),
          block('MA-2', 'High todo', 'high', 'To do'),
          block('MA-1', 'Low todo', 'low', 'To do'),
        ]),
      );
    });

    it('is empty when nothing is open', async () => {
      await api
        .client()
        .createTicket('MA', { title: 'Done', statusId: statusOf(project, 'done').id });
      const res = await api.get<PromptResult>('/api/projects/ma/prompt');
      expect(res.body).toEqual({ text: '', ticketCount: 0, role: 'work' });
    });
  });

  describe('marking as sent', () => {
    it('moves a To do ticket to the top of In progress when asked', async () => {
      const client = api.client();
      const doing = statusOf(project, 'in_progress');
      await client.createTicket('MA', { title: 'Busy', statusId: doing.id });
      const ticket = await client.createTicket('MA', { title: 'Send me' });
      const res = await api.post<Ticket>(`/api/tickets/${ticket.key}/sent`, {
        moveToInProgress: true,
      });
      expect(res.status).toBe(200);
      expect(res.body.statusId).toBe(doing.id);
      expect(res.body.updatedAt).toBeGreaterThan(ticket.updatedAt);
      const board = await client.getBoard('MA');
      expect(board.tickets.filter((t) => t.statusId === doing.id).map((t) => t.key)).toEqual([
        'MA-2',
        'MA-1',
      ]);
      expect(eventTexts(await client.getTicket(ticket.key)).at(-1)).toBe(
        'sent the ticket to Claude Code and moved it to In progress',
      );
    });

    it('only logs the send when the switch is off or the ticket is not in To do', async () => {
      const client = api.client();
      const ticket = await client.createTicket('MA', { title: 'Send me' });
      const off = await client.markSent(ticket.key, { moveToInProgress: false });
      expect(off.statusId).toBe(ticket.statusId);
      const review = statusOf(project, 'in_review').id;
      await client.updateTicket(ticket.key, { statusId: review });
      const later = await client.markSent(ticket.key, { moveToInProgress: true });
      expect(later.statusId).toBe(review);
      const texts = eventTexts(await client.getTicket(ticket.key));
      expect(texts.filter((text) => text.startsWith('sent'))).toEqual([
        'sent the ticket to Claude Code',
        'sent the ticket to Claude Code',
      ]);
    });

    it('uses the project’s own status names and defaults the switch to off', async () => {
      const client = api.client();
      await client.updateStatus(statusOf(project, 'in_progress').id, { name: 'Doing' });
      const ticket = await client.createTicket('MA', { title: 'Send me' });
      expect((await api.post<Ticket>(`/api/tickets/${ticket.key}/sent`, {})).body.statusId).toBe(
        ticket.statusId,
      );
      await client.markSent(ticket.key, { moveToInProgress: true });
      expect(eventTexts(await client.getTicket(ticket.key)).at(-1)).toBe(
        'sent the ticket to Claude Code and moved it to Doing',
      );
    });

    it('records the agent as the sender', async () => {
      const ticket = await api.client().createTicket('MA', { title: 'Send me' });
      await api.client(agent('Claude')).markSent(ticket.key, { moveToInProgress: true });
      const last = (await api.client().getTicket(ticket.key)).activity.at(-1);
      expect(last?.actor).toEqual({ kind: 'agent', name: 'Claude' });
    });
  });
});
