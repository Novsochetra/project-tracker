import type { ErrorBody, ProjectDetail, ReportPreview, ReportResult } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { eventTexts, statusOf } from '../helpers/fixtures';
import { DIALECTS, useTestServer } from '../helpers/server';

const REPORT = [
  'Here is what I did.',
  '',
  '```',
  '**TICKET:** ma-1',
  'STATUS: done',
  'SUMMARY: Fixed the crash.',
  'FILES: src/profile.ts',
  'NEXT: none',
  '```',
  '',
  'TICKET: WEB-1',
  'STATUS: in progress',
  'SUMMARY: Half way.',
  '',
  'TICKET: MA-9',
  'STATUS: done',
].join('\n');

describe.each(DIALECTS)('reports (%s)', (dialect) => {
  const api = useTestServer(dialect);
  let mobile: ProjectDetail;
  let web: ProjectDetail;

  beforeEach(async () => {
    const client = api.client();
    mobile = await client.createProject({ name: 'Mobile app' });
    web = await client.createProject({ name: 'Website' });
    await client.createTicket('MA', { title: 'Crash on rotate' });
    await client.createTicket('WEB', {
      title: 'Landing page',
      statusId: statusOf(web, 'in_progress').id,
    });
    api.events.length = 0;
  });

  it('previews keyed blocks across projects', async () => {
    const res = await api.post<ReportPreview>('/api/reports/preview', { text: REPORT });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      matchedCount: 2,
      items: [
        {
          key: 'MA-1',
          matched: true,
          ticketKey: 'MA-1',
          ticketTitle: 'Crash on rotate',
          fromStatusName: 'To do',
          toStatusName: 'Need review',
        },
        {
          key: 'WEB-1',
          matched: true,
          ticketKey: 'WEB-1',
          ticketTitle: 'Landing page',
          fromStatusName: 'In progress',
          toStatusName: null,
        },
        {
          key: 'MA-9',
          matched: false,
          ticketKey: null,
          ticketTitle: null,
          fromStatusName: null,
          toStatusName: null,
        },
      ],
    });
    expect(api.events).toEqual([]);
  });

  it('applies matched blocks: report activity, status event and top of the new group', async () => {
    const client = api.client();
    const review = statusOf(mobile, 'in_review').id;
    await client.createTicket('MA', { title: 'Already waiting', statusId: review });
    api.events.length = 0;

    const res = await api.post<ReportResult>('/api/reports/apply', { text: REPORT });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ updatedTicketKeys: ['MA-1', 'WEB-1'] });

    const ticket = await client.getTicket('MA-1');
    expect(ticket.status.id).toBe(review);
    expect(ticket.activity.slice(-2)).toMatchObject([
      {
        type: 'report',
        text: 'TICKET: ma-1\nSTATUS: done\nSUMMARY: Fixed the crash.\nFILES: src/profile.ts\nNEXT: none',
      },
      { type: 'event', text: 'changed status to Need review from a Claude Code report' },
    ]);
    const board = await client.getBoard('MA');
    expect(board.tickets.filter((t) => t.statusId === review).map((t) => t.key)).toEqual([
      'MA-1',
      'MA-2',
    ]);

    const unchanged = await client.getTicket('WEB-1');
    expect(unchanged.activity.at(-1)).toMatchObject({
      type: 'report',
      text: 'TICKET: WEB-1\nSTATUS: in progress\nSUMMARY: Half way.',
    });
    expect(unchanged.ticket.updatedAt).toBeGreaterThan(unchanged.ticket.createdAt);
    expect(api.events.map((e) => e.ticketId)).toEqual([ticket.ticket.id, unchanged.ticket.id]);
  });

  it('maps report words to categories and never to Done', async () => {
    const client = api.client();
    await client.applyReport({ text: 'TICKET: MA-1\nSTATUS: approved' });
    expect((await client.getTicket('MA-1')).status.name).toBe('Reviewed');
    await client.applyReport({ text: 'TICKET: MA-1\nSTATUS: blocked on API' });
    expect((await client.getTicket('MA-1')).status.name).toBe('In progress');
    await client.applyReport({ text: 'TICKET: MA-1\nSTATUS: not started' });
    expect((await client.getTicket('MA-1')).status.name).toBe('To do');
    await client.applyReport({ text: 'TICKET: MA-1\nSTATUS: complete' });
    expect((await client.getTicket('MA-1')).status.name).toBe('Need review');
    await client.applyReport({ text: 'TICKET: MA-1\nSTATUS: who knows' });
    expect((await client.getTicket('MA-1')).status.name).toBe('Need review');
  });

  it('applies a keyless block to the ticket it was opened from', async () => {
    const text = 'STATUS: in progress\nSUMMARY: Looking into it.';
    const preview = await api.client().previewReport({ text, ticketKey: 'ma-1' });
    expect(preview.items).toEqual([
      {
        key: null,
        matched: true,
        ticketKey: 'MA-1',
        ticketTitle: 'Crash on rotate',
        fromStatusName: 'To do',
        toStatusName: 'In progress',
      },
    ]);
    expect(await api.client().applyReport({ text, ticketKey: 'MA-1' })).toEqual({
      updatedTicketKeys: ['MA-1'],
    });
    expect(eventTexts(await api.client().getTicket('MA-1')).at(-1)).toBe(
      'changed status to In progress from a Claude Code report',
    );
  });

  it('answers 422 no_match when nothing matches', async () => {
    const keyless = await api.post<ErrorBody>('/api/reports/apply', { text: 'STATUS: done' });
    expect(keyless.status).toBe(422);
    expect(keyless.body.error.code).toBe('no_match');
    const unknown = await api.post<ErrorBody>('/api/reports/apply', {
      text: 'TICKET: MA-9\nSTATUS: done',
      ticketKey: 'MA-1',
    });
    expect(unknown.status).toBe(422);
    expect(unknown.body.error.message).toBe(
      'No matching ticket found. The report needs a line like “TICKET: MA-1”.',
    );
    expect((await api.client().getTicket('MA-1')).activity).toHaveLength(1);
    expect((await api.post<ReportPreview>('/api/reports/preview', { text: '' })).body).toEqual({
      items: [],
      matchedCount: 0,
    });
  });

  it('applies two blocks for the same ticket in order', async () => {
    const text = 'TICKET: MA-1\nSTATUS: in progress\n\nTICKET: MA-1\nSTATUS: done';
    expect(await api.client().applyReport({ text })).toEqual({ updatedTicketKeys: ['MA-1'] });
    expect(eventTexts(await api.client().getTicket('MA-1')).slice(1)).toEqual([
      'changed status to In progress from a Claude Code report',
      'changed status to Need review from a Claude Code report',
    ]);
  });
});
