import type { Priority } from '@tracker/shared';
import clsx from 'clsx';
import styles from './PriorityBars.module.css';

const BARS = [
  { x: 2, y: 9, height: 5 },
  { x: 6.5, y: 6, height: 8 },
  { x: 11, y: 3, height: 11 },
] as const;

const LEVEL: Record<Priority, number> = { low: 1, medium: 2, high: 3 };

export interface PriorityBarsProps {
  priority: Priority;
  className?: string | undefined;
}

export function PriorityBars({ priority, className }: PriorityBarsProps) {
  const level = LEVEL[priority];
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      data-priority={priority}
      className={clsx(styles.bars, className)}
    >
      {BARS.map((bar, index) => (
        <rect
          key={bar.x}
          x={bar.x}
          y={bar.y}
          width="3"
          height={bar.height}
          rx="1"
          className={index < level ? styles.on : styles.off}
        />
      ))}
    </svg>
  );
}
