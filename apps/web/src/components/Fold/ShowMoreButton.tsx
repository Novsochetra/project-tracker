import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';
import type { MouseEvent } from 'react';
import { Icon } from '../Icon';
import styles from './Fold.module.css';

export interface ShowMoreButtonProps {
  expanded: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  moreLabel?: string;
  lessLabel?: string;
  controls?: string | undefined;
  className?: string | undefined;
}

export function ShowMoreButton({
  expanded,
  onClick,
  moreLabel = 'Show more',
  lessLabel = 'Show less',
  controls,
  className,
}: ShowMoreButtonProps) {
  return (
    <button
      type="button"
      className={clsx('ring-inside', styles.more, className)}
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onClick}
    >
      {expanded ? lessLabel : moreLabel}
      <Icon icon={ChevronDown} className={styles.chevron} />
    </button>
  );
}
