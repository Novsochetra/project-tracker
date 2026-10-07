import type { StatusCategory } from '@tracker/shared';
import clsx from 'clsx';
import styles from './StatusGlyph.module.css';

const HALF_PIE = 'M8 4.5a3.5 3.5 0 0 1 0 7z';
const THREE_QUARTER_PIE = 'M8 4.5a3.5 3.5 0 1 1-3.5 3.5H8z';

export interface StatusGlyphProps {
  category: StatusCategory;
  color: string;
  size?: number;
  animated?: boolean;
  className?: string | undefined;
}

export function StatusGlyph({
  category,
  color,
  size = 16,
  animated = true,
  className,
}: StatusGlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      data-category={category}
      className={clsx(styles.glyph, animated && styles.animated, className)}
      style={{ color }}
    >
      <Shape category={category} />
    </svg>
  );
}

function Shape({ category }: { category: StatusCategory }) {
  switch (category) {
    case 'todo':
      return <Ring />;
    case 'in_progress':
      return (
        <>
          <Ring />
          <path d={HALF_PIE} fill="currentColor" />
        </>
      );
    case 'in_review':
      return (
        <>
          <Ring />
          <path d={THREE_QUARTER_PIE} fill="currentColor" />
        </>
      );
    case 'reviewed':
      return (
        <>
          <Ring />
          <circle cx="8" cy="8" r="3.5" fill="currentColor" />
        </>
      );
    case 'done':
      return (
        <>
          <circle className={styles.disc} cx="8" cy="8" r="7" fill="currentColor" />
          <path
            className={styles.check}
            d="m5 8.25 2 2 4-4.25"
            fill="none"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
  }
}

function Ring() {
  return <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />;
}
