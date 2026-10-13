import clsx from 'clsx';
import styles from './Labels.module.css';

export interface LabelDotProps {
  color: string;
  large?: boolean;
  className?: string | undefined;
}

export function LabelDot({ color, large = false, className }: LabelDotProps) {
  return (
    <span
      className={clsx(styles.dot, large && styles.dotLarge, className)}
      style={{ color }}
      aria-hidden="true"
    />
  );
}
