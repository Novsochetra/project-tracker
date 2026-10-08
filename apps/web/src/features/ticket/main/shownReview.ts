import { isSentBack, type Review, type StatusCategory } from '@tracker/shared';
import type { ActivityItem } from '../activity/activityItems';

type ReviewItem = Extract<ActivityItem, { kind: 'review' }>;

export type ShownReview = ReviewItem & { review: Review };

// A reviewed ticket waits for its owner. A sent-back one shows why it came back until it is
// submitted again, for the owner and for the next worker.
export function shownReview(
  category: StatusCategory,
  items: readonly ActivityItem[],
): ShownReview | null {
  const latest = items.findLast((item): item is ReviewItem => item.kind === 'review');
  if (!latest?.review) return null;
  const shown = category === 'reviewed' || isSentBack(latest.review, category);
  return shown ? { ...latest, review: latest.review } : null;
}
