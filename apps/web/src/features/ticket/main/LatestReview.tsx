import { findStatusByCategory, type TicketDetail } from '@tracker/shared';
import { useEffect, useMemo, useState } from 'react';
import { useNow } from '../../../lib/useNow';
import { activityItems } from '../activity/activityItems';
import { ActivityCard, ActorAvatar } from '../activity/ActivityCard';
import cardStyles from '../activity/ActivityCard.module.css';
import { LinkedText } from '../activity/LinkedText';
import { ReviewVerdict } from '../activity/ReviewVerdict';
import { TimeAgo } from '../activity/TimeAgo';
import { DoneButton } from '../DoneButton';
import type { MoveToDone } from '../useMoveToDone';
import styles from './LatestReview.module.css';
import { shownReview, type ShownReview } from './shownReview';

// Longer than a double tap, whose second tap lands within about 300 ms.
const LEAVE_AFTER_MS = 500;

export interface LatestReviewProps {
  detail: TicketDetail;
  done: MoveToDone | null;
}

interface Shown {
  review: ShownReview;
  done: MoveToDone | null;
}

// A card that left at once let the second tap of a double tap on its Move to Done land on what
// moved up into its place: the photo picker or the description. It stays a moment, taking no taps.
function useLeaving(): [Shown | null, (shown: Shown) => void] {
  const [leaving, setLeaving] = useState<Shown | null>(null);
  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => setLeaving(null), LEAVE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [leaving]);
  return [leaving, setLeaving];
}

export function LatestReview({ detail, done }: LatestReviewProps) {
  const now = useNow();
  const items = useMemo(() => activityItems(detail.activity), [detail.activity]);
  const review = shownReview(detail.status.category, items);
  const [leaving, leave] = useLeaving();
  const shown = leaving ?? (review && { review, done });
  if (!shown) return null;
  const approvedColor = findStatusByCategory(detail.statuses, 'reviewed')?.color;
  const target = shown.done;
  const moveToDone = target && {
    ...target,
    move: () => {
      leave(shown);
      target.move();
    },
  };
  return (
    <section aria-label="Latest review" className={styles.latest} inert={leaving !== null}>
      <ActivityCard
        avatar={<ActorAvatar actor={shown.review.actor} />}
        title={`${shown.review.author} reviewed`}
        meta={<TimeAgo at={shown.review.at} now={now} />}
        dimmed={leaving !== null}
      >
        <ReviewVerdict review={shown.review.review} approvedColor={approvedColor} />
        {shown.review.text && (
          <p className={cardStyles.body}>
            <LinkedText text={shown.review.text} />
          </p>
        )}
        {moveToDone && <DoneButton done={moveToDone} size="lg" className={styles.done} />}
      </ActivityCard>
    </section>
  );
}
