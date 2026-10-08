import type { Review, StatusCategory } from '@tracker/shared';
import type { ActivityItem } from '../activity/activityItems';

type ReviewItem = Extract<ActivityItem, { kind: 'review' }>;

export type ShownReview = ReviewItem & { review: Review };

const SENT_BACK_TO: readonly StatusCategory[] = ['todo', 'in_progress'];

// A reviewed ticket waits for its owner. A sent-back one shows why it came back until it is
// submitted again, for the owner and for the next worker.
export function shownReview(
  category: StatusCategory,
  items: readonly ActivityItem[],
): ShownReview | null {
  const latest = items.findLast((item): item is ReviewItem => item.kind === 'review');
  if (!latest?.review) return null;
  const sentBack = latest.review.verdict === 'changes_requested' && SENT_BACK_TO.includes(category);
  return category === 'reviewed' || sentBack ? { ...latest, review: latest.review } : null;
}
