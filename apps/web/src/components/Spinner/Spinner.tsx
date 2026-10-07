import clsx from 'clsx';
import styles from './Spinner.module.css';

export interface SpinnerProps {
  size?: 14 | 16 | 20;
  label?: string;
  className?: string | undefined;
}

export function Spinner({ size = 16, label = 'Loading', className }: SpinnerProps) {
  return (
    <span role="status" className={clsx(styles.spinner, className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
        focusable="false"
        className={styles.svg}
      >
        <circle cx="8" cy="8" r="6.25" className={styles.track} />
        <path d="M8 1.75a6.25 6.25 0 0 1 6.25 6.25" strokeLinecap="round" />
      </svg>
      <span className="visually-hidden">{label}</span>
    </span>
  );
}
