import type { Actor } from './actor';
import type { Attachment } from './attachment';

export const ACTIVITY_TYPES = ['event', 'comment', 'report', 'review'] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const COMMENT_TEXT_MAX = 20_000;
export const REPORT_TEXT_MAX = 20_000;

export const REVIEW_VERDICTS = ['approved', 'changes_requested'] as const;

export type ReviewVerdict = (typeof REVIEW_VERDICTS)[number];

export const VERDICT_LABELS: Record<ReviewVerdict, string> = {
  approved: 'Approved',
  changes_requested: 'Changes requested',
};

export interface Review {
  verdict: ReviewVerdict;
  rating: number;
}

export interface Activity {
  id: string;
  ticketId: string;
  type: ActivityType;
  actor: Actor;
  text: string;
  review: Review | null;
  attachments: Attachment[];
  createdAt: number;
  editedAt: number | null;
}
