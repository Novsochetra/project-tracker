import type { Activity, ReviewVerdict, StatusCategory } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { comment } from '../../../api/test/fixtures';
import { activityItems } from '../activity/activityItems';
import { shownReview } from './shownReview';

const REVIEWER = { kind: 'agent', name: 'Reviewer' } as const;

const review = (id: string, verdict: ReviewVerdict, createdAt: number): Activity =>
  comment(id, `${verdict} because…`, {
    type: 'review',
    actor: REVIEWER,
    review: { verdict, rating: verdict === 'approved' ? 4 : 2 },
    createdAt,
  });

const shown = (category: StatusCategory, activity: Activity[]) =>
  shownReview(category, activityItems(activity))?.id ?? null;

describe('shownReview', () => {
  it('shows the newest review of a reviewed ticket', () => {
    const activity = [review('v2', 'approved', 20), review('v1', 'changes_requested', 10)];
    expect(shown('reviewed', activity)).toBe('v2');
    expect(shownReview('reviewed', activityItems(activity))).toMatchObject({
      author: 'Reviewer',
      text: 'approved because…',
      review: { verdict: 'approved', rating: 4 },
    });
  });

  it('shows why a ticket was sent back while it waits in To do or In progress', () => {
    const activity = [review('v1', 'approved', 10), review('v2', 'changes_requested', 20)];
    expect(shown('todo', activity)).toBe('v2');
    expect(shown('in_progress', activity)).toBe('v2');
  });

  it('shows nothing once a sent-back ticket is submitted again or finished', () => {
    const activity = [review('v1', 'changes_requested', 10)];
    expect(shown('in_review', activity)).toBeNull();
    expect(shown('done', activity)).toBeNull();
  });

  it('shows nothing for an approval on a ticket that went back to work', () => {
    expect(shown('todo', [review('v1', 'approved', 10)])).toBeNull();
    expect(shown('done', [review('v1', 'approved', 10)])).toBeNull();
  });

  it('shows nothing without a review', () => {
    expect(shown('reviewed', [comment('c1', 'Looks fine')])).toBeNull();
    expect(shown('reviewed', [{ ...review('v1', 'approved', 10), review: null }])).toBeNull();
  });
});
