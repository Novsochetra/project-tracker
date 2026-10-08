import type { SheetRequest } from '../../app/sheets/types';

export const promptSheet = (ticketKey: string): SheetRequest => ({
  type: 'prompt',
  scope: { kind: 'ticket', ticketKey },
});

export const reportSheet = (ticketKey: string, projectKey: string): SheetRequest => ({
  type: 'report',
  scope: { kind: 'ticket', ticketKey, projectKey },
});
