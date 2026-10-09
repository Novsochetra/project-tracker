import clsx from 'clsx';
import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useIsPhone } from '../lib/media';
import styles from './NavBar.module.css';
import { useLargeTitleState } from './useLargeTitle';
import { useOptionalNavigation } from './useNavigation';
import { useTapToTop } from './useTapToTop';

export interface NavBarProps {
  title?: string;
  mono?: boolean;
  backLabel?: string;
  onBack?: () => void;
  // Shown on the leading side of a screen without a back button, such as Projects.
  left?: ReactNode;
  right?: ReactNode;
}

export function NavBar({ title, mono = false, backLabel, onBack, left, right }: NavBarProps) {
  const isPhone = useIsPhone();
  const navigation = useOptionalNavigation();
  const largeTitle = useLargeTitleState();
  const tapToTopRef = useTapToTop();
  if (!isPhone) return null;

  const handleBack = onBack ?? navigation?.back;
  const expanded = largeTitle.present && largeTitle.visible;
  return (
    <header
      ref={tapToTopRef}
      className={styles.bar}
      data-navbar=""
      data-expanded={expanded || undefined}
    >
      <div className={clsx(styles.side, styles.lead)}>
        {backLabel === undefined && left}
        {backLabel !== undefined && handleBack && (
          <button
            type="button"
            className={styles.back}
            onClick={() => handleBack()}
            aria-label={`Back to ${backLabel}`}
          >
            <ChevronLeft size={20} strokeWidth={1.75} className={styles.chevron} />
            <span className={styles.backLabel}>{backLabel}</span>
          </button>
        )}
      </div>
      <div className={styles.titleSlot} aria-hidden={expanded || undefined}>
        {title !== undefined && (
          <span key={title} className={clsx(styles.title, mono && styles.mono)}>
            {title}
          </span>
        )}
      </div>
      <div className={clsx(styles.side, styles.end)}>{right}</div>
    </header>
  );
}
