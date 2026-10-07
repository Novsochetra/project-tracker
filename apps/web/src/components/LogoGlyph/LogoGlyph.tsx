import clsx from 'clsx';
import styles from './LogoGlyph.module.css';

export function LogoGlyph({ className }: { className?: string }) {
  return (
    <span className={clsx(styles.tile, className)} aria-hidden="true">
      <svg width="12" height="12" viewBox="0 0 12 12" focusable="false">
        <rect x="1" y="1" width="4" height="4" rx="1" />
        <rect x="7" y="1" width="4" height="4" rx="1" opacity="0.55" />
        <rect x="1" y="7" width="4" height="4" rx="1" opacity="0.55" />
        <rect x="7" y="7" width="4" height="4" rx="1" />
      </svg>
    </span>
  );
}
