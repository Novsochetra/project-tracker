import clsx from 'clsx';
import type { CSSProperties } from 'react';
import styles from './Segmented.module.css';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  count?: number | undefined;
}

export interface SegmentedProps<T extends string> {
  'aria-label': string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string | undefined;
}

export function Segmented<T extends string>({
  'aria-label': label,
  options,
  value,
  onChange,
  className,
}: SegmentedProps<T>) {
  const index = options.findIndex((option) => option.value === value);
  const layout = { '--count': options.length, '--index': Math.max(index, 0) } as CSSProperties;
  return (
    <div role="group" aria-label={label} className={clsx(styles.track, className)} style={layout}>
      {index >= 0 && <span className={styles.thumb} aria-hidden="true" />}
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          className={styles.segment}
          onClick={() => onChange(option.value)}
        >
          {option.label}{' '}
          {option.count !== undefined && <span className={styles.count}>{option.count}</span>}
        </button>
      ))}
    </div>
  );
}
