import type { Review } from '@tracker/shared';
import { StarRating } from '../../../components';
import { VerdictChip } from '../../ready';
import styles from './ActivityCard.module.css';

export interface ReviewVerdictProps {
  review: Review;
  approvedColor?: string | undefined;
}

export function ReviewVerdict({ review, approvedColor }: ReviewVerdictProps) {
  return (
    <div className={styles.verdictRow}>
      <VerdictChip verdict={review.verdict} approvedColor={approvedColor} />
      <StarRating value={review.rating} />
    </div>
  );
}
