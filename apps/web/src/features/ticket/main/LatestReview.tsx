import { findStatusByCategory, type TicketDetail } from '@tracker/shared';
import { useMemo } from 'react';
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
import { shownReview } from './shownReview';

export interface LatestReviewProps {
  detail: TicketDetail;
  done: MoveToDone | null;
}

export function LatestReview({ detail, done }: LatestReviewProps) {
  const now = useNow();
  const items = useMemo(() => activityItems(detail.activity), [detail.activity]);
  const review = shownReview(detail.status.category, items);
  if (!review) return null;
  const approvedColor = findStatusByCategory(detail.statuses, 'reviewed')?.color;
  return (
    <section aria-label="Latest review" className={styles.latest}>
      <ActivityCard
        avatar={<ActorAvatar actor={review.actor} />}
        title={`${review.author} reviewed`}
        meta={<TimeAgo at={review.at} now={now} />}
      >
        <ReviewVerdict review={review.review} approvedColor={approvedColor} />
        {review.text && (
          <p className={cardStyles.body}>
            <LinkedText text={review.text} />
          </p>
        )}
        {done && <DoneButton done={done} size="lg" className={styles.done} />}
      </ActivityCard>
    </section>
  );
}
