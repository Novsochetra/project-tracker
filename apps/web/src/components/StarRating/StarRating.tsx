import clsx from 'clsx';
import { Star } from 'lucide-react';
import { Icon } from '../Icon';
import styles from './StarRating.module.css';

const STARS = [1, 2, 3, 4, 5] as const;

export interface StarRatingProps {
  value: number;
  size?: 14 | 16;
  className?: string | undefined;
}

export function StarRating({ value, size = 14, className }: StarRatingProps) {
  const rating = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span
      role="img"
      aria-label={`Rated ${rating} out of 5`}
      className={clsx(styles.stars, className)}
    >
      {STARS.map((star) => (
        <Icon
          key={star}
          icon={Star}
          size={size}
          className={star <= rating ? styles.on : styles.off}
        />
      ))}
      <span className={styles.score} aria-hidden="true">
        {rating}/5
      </span>
    </span>
  );
}
