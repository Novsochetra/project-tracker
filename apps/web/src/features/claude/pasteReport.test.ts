import { ApiError } from '@tracker/client';
import type { ReportPreview, ReportPreviewItem } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import {
  appliedMessage,
  isNoMatch,
  noMatchMessage,
  previewRow,
  reportHelp,
  reportPlaceholder,
  reportSubtitle,
  reportView,
  type ReportState,
} from './pasteReport';

const ticketScope = { kind: 'ticket', ticketKey: 'MOB-3', projectKey: 'MOB' } as const;
const projectScope = { kind: 'project', projectKey: 'MOB' } as const;

const item = (overrides: Partial<ReportPreviewItem>): ReportPreviewItem => ({
  key: 'MOB-2',
  matched: true,
  ticketKey: 'MOB-2',
  ticketTitle: 'Show an error when the password is wrong',
  fromStatusName: 'In progress',
  toStatusName: null,
  ...overrides,
});

describe('previewRow', () => {
  it('shows a status change as From → To', () => {
    expect(previewRow(item({ toStatusName: 'Need review' }))).toEqual({
      keyLabel: 'MOB-2',
      title: 'Show an error when the password is wrong',
      outcome: 'In progress → Need review',
      skipped: false,
    });
  });

  it('says Add report when the status stays', () => {
    expect(previewRow(item({})).outcome).toBe('Add report');
  });

  it('labels a keyless block applied to the current ticket with that ticket’s key', () => {
    const row = previewRow(item({ key: null, ticketKey: 'MOB-3', ticketTitle: '' }));
    expect(row.keyLabel).toBe('MOB-3');
    expect(row.title).toBe('Untitled');
  });

  it('skips a block whose ticket does not exist', () => {
    expect(
      previewRow(item({ key: 'MOB-9', matched: false, ticketKey: null, ticketTitle: null })),
    ).toEqual({
      keyLabel: 'MOB-9',
      title: 'No ticket with this ID',
      outcome: 'Skipped',
      skipped: true,
    });
  });

  it('skips a block without a TICKET line', () => {
    const row = previewRow(item({ key: null, matched: false, ticketKey: null }));
    expect(row).toMatchObject({ keyLabel: '—', title: 'No TICKET line found', outcome: 'Skipped' });
  });
});

describe('report sheet copy', () => {
  it('explains each scope', () => {
    expect(reportHelp(ticketScope)).toBe(
      'Paste Claude Code’s reply. Its TICKET / STATUS block updates the ticket, and the report is saved to the activity. With no TICKET line, it’s added to MOB-3.',
    );
    expect(reportHelp(projectScope)).toBe(
      'Paste Claude Code’s reply. Each block that starts with “TICKET: KEY-123” updates that ticket’s status and is saved to its activity.',
    );
  });

  it('subtitles the ticket key or the project name', () => {
    expect(reportSubtitle(ticketScope, 'Mobile app')).toBe('MOB-3');
    expect(reportSubtitle(projectScope, 'Mobile app')).toBe('Mobile app');
    expect(reportSubtitle(projectScope, undefined)).toBe('');
  });

  it('uses a five-line template for the placeholder', () => {
    expect(reportPlaceholder(ticketScope).split('\n')).toEqual([
      'TICKET: MOB-3',
      'STATUS: done',
      'SUMMARY: …',
      'FILES: …',
      'NEXT: none',
    ]);
    expect(reportPlaceholder(projectScope)).toMatch(/^TICKET: MOB-1\n/);
  });

  it('names the project key when nothing matched', () => {
    expect(noMatchMessage('MOB')).toBe(
      'No matching ticket found. The report needs a line like “TICKET: MOB-1”.',
    );
  });

  it('counts applied tickets', () => {
    expect(appliedMessage(1)).toBe('Report applied to 1 ticket');
    expect(appliedMessage(2)).toBe('Report applied to 2 tickets');
  });

  it('recognises the no_match error', () => {
    expect(isNoMatch(new ApiError(422, 'no_match', 'No matching ticket found.'))).toBe(true);
    expect(isNoMatch(new ApiError(400, 'invalid_input', 'Bad'))).toBe(false);
    expect(isNoMatch(new Error('no_match'))).toBe(false);
  });
});

describe('reportView', () => {
  const preview: ReportPreview = {
    items: [item({ toStatusName: 'Need review' })],
    matchedCount: 1,
  };
  const state: ReportState = {
    text: 'TICKET: MOB-2\nSTATUS: done',
    error: null,
    preview,
    previewError: null,
    applying: false,
  };

  it('lists the preview and allows Apply once a block matches', () => {
    expect(reportView(state)).toEqual({
      text: state.text,
      items: preview.items,
      canApply: true,
      error: null,
    });
  });

  it('keeps Apply off while nothing matches or the report is being applied', () => {
    expect(reportView({ ...state, preview: { ...preview, matchedCount: 0 } }).canApply).toBe(false);
    expect(reportView({ ...state, preview: undefined }).canApply).toBe(false);
    expect(reportView({ ...state, applying: true }).canApply).toBe(false);
  });

  it('shows no preview or preview error for an empty box', () => {
    expect(reportView({ ...state, text: '  ', previewError: 'Can’t reach the tracker.' })).toEqual({
      text: '  ',
      items: [],
      canApply: false,
      error: null,
    });
  });

  it('shows the form’s own error before a preview error', () => {
    expect(reportView({ ...state, previewError: 'Preview failed' }).error).toBe('Preview failed');
    expect(
      reportView({ ...state, error: 'The clipboard is empty.', previewError: 'Preview failed' })
        .error,
    ).toBe('The clipboard is empty.');
  });
});
