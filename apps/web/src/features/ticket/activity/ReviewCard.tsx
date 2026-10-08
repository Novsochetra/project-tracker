import type { Review } from '@tracker/shared';
import clsx from 'clsx';
import { Check, RotateCcw } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Icon, StarRating } from '../../../components';
import { VERDICT_LABELS, type ActivityItem } from './activityItems';
import { ActivityCard, ActorAvatar, CardImages, type RiseProps } from './ActivityCard';
import styles from './ActivityCard.module.css';
import { ItemMenu } from './ItemMenu';
import { TimeAgo } from './TimeAgo';
import type { ActivityActions } from './useActivityActions';

export interface ReviewCardProps {
  item: Extract<ActivityItem, { kind: 'review' }>;
  now: number;
  actions: ActivityActions;
  rise: RiseProps;
  /** The project's Reviewed status color, so an approval looks like where it moved the ticket. */
  approvedColor?: string | undefined;
}

export function ReviewCard({ item, now, actions, rise, approvedColor }: ReviewCardProps) {
  return (
    <ActivityCard
      avatar={<ActorAvatar actor={item.actor} />}
      title={`${item.author} reviewed`}
      meta={<TimeAgo at={item.at} now={now} />}
      menu={<ItemMenu noun="review" onDelete={() => actions.remove(item.id)} />}
      {...rise}
    >
      {item.review && <Verdict review={item.review} approvedColor={approvedColor} />}
      {item.text && <p className={styles.body}>{item.text}</p>}
      <CardImages images={item.images} />
    </ActivityCard>
  );
}

interface VerdictProps {
  review: Review;
  approvedColor?: string | undefined;
}

function Verdict({ review, approvedColor }: VerdictProps) {
  const approved = review.verdict === 'approved';
  const color = approved && approvedColor ? ({ '--verdict': approvedColor } as CSSProperties) : {};
  return (
    <div className={styles.verdictRow}>
      <span
        className={clsx(styles.verdict, approved ? styles.approved : styles.changes)}
        style={color}
      >
        <Icon icon={approved ? Check : RotateCcw} size={14} />
        {VERDICT_LABELS[review.verdict]}
      </span>
      <StarRating value={review.rating} />
    </div>
  );
}
