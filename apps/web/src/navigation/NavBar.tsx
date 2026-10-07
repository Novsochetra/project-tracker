import clsx from 'clsx';
import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useIsPhone } from '../lib/media';
import styles from './NavBar.module.css';
import { useLargeTitleState } from './useLargeTitle';
import { useOptionalNavigation } from './useNavigation';

export interface NavBarProps {
  title?: string;
  mono?: boolean;
  backLabel?: string;
  onBack?: () => void;
  right?: ReactNode;
}

export function NavBar({ title, mono = false, backLabel, onBack, right }: NavBarProps) {
  const isPhone = useIsPhone();
  const navigation = useOptionalNavigation();
  const largeTitle = useLargeTitleState();
  if (!isPhone) return null;

  const handleBack = onBack ?? navigation?.back;
  const expanded = largeTitle.present && largeTitle.visible;
  return (
    <header className={styles.bar} data-navbar="" data-expanded={expanded || undefined}>
      <div className={styles.side}>
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
