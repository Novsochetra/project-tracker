import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { serve } from '@hono/node-server';
import type { Attachment, ChangeEvent } from '@tracker/shared';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app';
import { agent, imageForm, statusOf } from '../helpers/fixtures';
import { DIALECTS, useTestServer } from '../helpers/server';

type Reader = ReadableStreamDefaultReader<Uint8Array>;

async function readUntil(reader: Reader, pattern: RegExp): Promise<string> {
  const decoder = new TextDecoder();
  let text = '';
  while (!pattern.test(text)) {
    const chunk = await reader.read();
    if (chunk.done) throw new Error(`Stream ended before ${String(pattern)}: ${text}`);
    text += decoder.decode(chunk.value, { stream: true });
  }
  return text;
}

const dataLines = (text: string): ChangeEvent[] =>
  [...text.matchAll(/^data: (.+)$/gm)].map((match) => JSON.parse(match[1]!) as ChangeEvent);

describe.each(DIALECTS)('change events (%s)', (dialect) => {
  const api = useTestServer(dialect);

  it('publishes one change after every successful mutation', async () => {
    const person = api.client();
    const worker = api.client(agent());
    const project = await person.createProject({ name: 'Mobile app' });
    const p = project.project.id;
    const ticket = await person.createTicket('MA', { title: 'Crash' });
    const t = ticket.id;
    const review = statusOf(project, 'in_review').id;
    expect(api.events).toEqual([
      { type: 'changed', projectId: p, ticketId: null },
      { type: 'changed', projectId: p, ticketId: t },
    ]);

    const steps: [string, () => Promise<unknown>, string | null][] = [
      ['update project', () => person.updateProject('MA', { name: 'Phone app' }), null],
      [
        'create status',
        () => person.createStatus('MA', { name: 'Blocked', category: 'in_progress' }),
        null,
      ],
      ['update status', () => person.updateStatus(review, { color: '#0091FF' }), null],
      [
        'reorder statuses',
        async () =>
          person.reorderStatuses(
            'MA',
            (await person.getProject('MA')).statuses.map((s) => s.id),
          ),
        null,
      ],
      ['update ticket', () => person.updateTicket('MA-1', { priority: 'high' }), t],
      ['move ticket', () => person.moveTicket('MA-1', { statusId: review }), t],
      ['mark sent', () => person.markSent('MA-1', { moveToInProgress: false }), t],
      ['comment', () => person.addComment('MA-1', { text: 'note' }), t],
      [
        'edit comment',
        async () =>
          person.updateComment((await person.getTicket('MA-1')).activity.at(-1)!.id, {
            text: 'edited',
          }),
        t,
      ],
      [
        'delete comment',
        async () => person.deleteActivity((await person.getTicket('MA-1')).activity.at(-1)!.id),
        t,
      ],
      ['upload to ticket', () => api.post('/api/attachments', imageForm({ ticketKey: 'MA-1' })), t],
      [
        'delete image',
        async () => person.deleteAttachment((await person.getTicket('MA-1')).attachments[0]!.id),
        t,
      ],
      ['apply report', () => person.applyReport({ text: 'TICKET: MA-1\nSTATUS: wip' }), t],
      ['claim', () => worker.claimTicket('MA-1'), t],
      ['submit', () => worker.submitForReview('MA-1', { summary: 'done' }), t],
      [
        'review',
        () => worker.reviewTicket('MA-1', { verdict: 'approved', rating: 5, summary: 'ok' }),
        t,
      ],
      [
        'claim next',
        async () => {
          await person.createTicket('MA', { title: 'Next' });
          api.events.length = 0;
          return worker.claimNext('MA');
        },
        'next',
      ],
      [
        'delete status',
        async () =>
          person.deleteStatus(
            (await person.getProject('MA')).statuses.find((s) => s.name === 'Blocked')!.id,
          ),
        null,
      ],
      ['delete ticket', () => person.deleteTicket('MA-1'), t],
      ['delete project', () => person.deleteProject('MA'), null],
    ];
    for (const [name, step, ticketId] of steps) {
      api.events.length = 0;
      const result = await step();
      const expected =
        ticketId === 'next' ? (result as { ticket: { id: string } }).ticket.id : ticketId;
      expect(api.events, name).toEqual([{ type: 'changed', projectId: p, ticketId: expected }]);
    }
  });

  it('stays quiet for pending images, reads and failures', async () => {
    const pending = await api.post<Attachment>('/api/attachments', imageForm());
    expect(pending.status).toBe(201);
    const discarded = await api.post<Attachment>('/api/attachments', imageForm());
    expect((await api.delete(`/api/attachments/${discarded.body.id}`)).status).toBe(204);
    expect(api.events).toEqual([]);
    await api.client().createProject({ name: 'Mobile app' });
    api.events.length = 0;
    await api.get('/api/projects');
    await api.get('/api/projects/MA/board');
    await api.get(pending.body.url);
    await api.post('/api/projects', { name: '' });
    await api.patch('/api/tickets/MA-9', { title: 'x' });
    await api.post('/api/reports/apply', { text: 'TICKET: MA-9' });
    await api.post('/api/projects/MA/claim', undefined, { actor: agent() });
    expect(api.events).toEqual([]);
  });

  it('publishes image changes that belong to a ticket', async () => {
    await api.client().createProject({ name: 'Mobile app' });
    const ticket = await api.client().createTicket('MA', { title: 'Crash' });
    const pending = await api.post<Attachment>('/api/attachments', imageForm());
    const comment = await api.client().addComment(ticket.key, { attachmentIds: [pending.body.id] });
    api.events.length = 0;
    const change = { type: 'changed', projectId: ticket.projectId, ticketId: ticket.id };

    await api.post('/api/attachments', imageForm({ ticketKey: ticket.key }));
    expect(api.events).toEqual([change]);
    await api.delete(`/api/attachments/${comment.attachments[0]!.id}`);
    expect(api.events).toEqual([change, change]);
  });

  it('streams changes as SSE data lines and unsubscribes when the client goes away', async () => {
    const baseline = api.broadcaster.listenerCount();
    const res = await api.app.request('/api/events');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/event-stream');
    expect(res.headers.get('cache-control')).toBe('no-cache');
    const reader = res.body!.getReader();
    await readUntil(reader, /: connected\n\n/);
    expect(api.broadcaster.listenerCount()).toBe(baseline + 1);

    const created = await api.client().createProject({ name: 'Mobile app' });
    const text = await readUntil(reader, /^data: .+\n\n/m);
    expect(dataLines(text)).toEqual([
      { type: 'changed', projectId: created.project.id, ticketId: null },
    ]);

    await reader.cancel();
    await vi.waitFor(() => expect(api.broadcaster.listenerCount()).toBe(baseline));
  });

  it('sends a heartbeat comment on an interval', async () => {
    const app = createApp({
      db: api.db,
      storage: api.storage,
      events: api.broadcaster,
      heartbeatMs: 20,
    });
    const res = await app.request('/api/events');
    const reader = res.body!.getReader();
    const text = await readUntil(reader, /: heartbeat\n\n/);
    expect(dataLines(text)).toEqual([]);
    await reader.cancel();
  });

  it('works over a real HTTP connection', async () => {
    const server = serve({
      fetch: api.app.fetch,
      port: 0,
      hostname: '127.0.0.1',
      overrideGlobalObjects: false,
    });
    await once(server, 'listening');
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const baseline = api.broadcaster.listenerCount();
    const controller = new AbortController();
    try {
      const res = await fetch(`${base}/api/events`, { signal: controller.signal });
      expect(res.headers.get('content-type')).toBe('text/event-stream');
      const reader = res.body!.getReader();
      await readUntil(reader, /: connected\n\n/);

      const create = await fetch(`${base}/api/projects`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Live' }),
      });
      expect(create.status).toBe(201);
      const text = await readUntil(reader, /^data: .+\n\n/m);
      expect(dataLines(text)).toMatchObject([{ type: 'changed', ticketId: null }]);

      controller.abort();
      await vi.waitFor(() => expect(api.broadcaster.listenerCount()).toBe(baseline));
    } finally {
      controller.abort();
      server.close();
    }
  });
});
