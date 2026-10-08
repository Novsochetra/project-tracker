import { ApiError } from '@tracker/client';
import type { ReportPreviewItem } from '@tracker/shared';
import type { ReportScope } from '../../app/sheets/types';

export const reportHelp = (scope: ReportScope): string =>
  scope.kind === 'ticket'
    ? `Paste Claude Code’s reply. Its TICKET / STATUS block updates the ticket, and the report is saved to the activity. With no TICKET line, it’s added to ${scope.ticketKey}.`
    : 'Paste Claude Code’s reply. Each block that starts with “TICKET: KEY-123” updates that ticket’s status and is saved to its activity.';

export const reportSubtitle = (scope: ReportScope, projectName: string | undefined): string =>
  scope.kind === 'ticket' ? scope.ticketKey : (projectName ?? '');

export const reportPlaceholder = (scope: ReportScope): string =>
  [
    `TICKET: ${scope.kind === 'ticket' ? scope.ticketKey : `${scope.projectKey}-1`}`,
    'STATUS: done',
    'SUMMARY: …',
    'FILES: …',
    'NEXT: none',
  ].join('\n');

export const noMatchMessage = (projectKey: string): string =>
  `No matching ticket found. The report needs a line like “TICKET: ${projectKey}-1”.`;

export const appliedMessage = (count: number): string =>
  `Report applied to ${count} ticket${count === 1 ? '' : 's'}`;

export const isNoMatch = (error: unknown): boolean =>
  error instanceof ApiError && error.code === 'no_match';

export interface PreviewRow {
  keyLabel: string;
  title: string;
  outcome: string;
  skipped: boolean;
}

function outcomeOf(item: ReportPreviewItem): string {
  if (!item.toStatusName) return 'Add report';
  return `${item.fromStatusName ?? '—'} → ${item.toStatusName}`;
}

export function previewRow(item: ReportPreviewItem): PreviewRow {
  if (!item.matched) {
    return {
      keyLabel: item.key ?? '—',
      title: item.key ? 'No ticket with this ID' : 'No TICKET line found',
      outcome: 'Skipped',
      skipped: true,
    };
  }
  return {
    keyLabel: item.ticketKey ?? item.key ?? '—',
    title: item.ticketTitle || 'Untitled',
    outcome: outcomeOf(item),
    skipped: false,
  };
}
