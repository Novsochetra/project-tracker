import { z } from 'zod';
import type { RunRole } from '../domain/run';

export interface PromptResult {
  text: string;
  ticketCount: number;
  role: RunRole;
}

export const markSentInput = z.object({ moveToInProgress: z.boolean().default(false) });
export type MarkSentInput = z.input<typeof markSentInput>;

export const reportInput = z.object({
  text: z.string().max(100_000),
  ticketKey: z.string().max(40).optional(),
});
export type ReportInput = z.input<typeof reportInput>;

export interface ReportPreviewItem {
  key: string | null;
  matched: boolean;
  ticketKey: string | null;
  ticketTitle: string | null;
  fromStatusName: string | null;
  toStatusName: string | null;
}

export interface ReportPreview {
  items: ReportPreviewItem[];
  matchedCount: number;
}

export interface ReportResult {
  updatedTicketKeys: string[];
}
