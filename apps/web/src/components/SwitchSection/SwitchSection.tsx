import clsx from 'clsx';
import { useId, type ReactNode } from 'react';
import { GroupedCard } from '../GroupedCard';
import { Switch } from '../Switch';
import styles from './SwitchSection.module.css';

export interface SwitchSectionProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean | undefined;
  note?: ReactNode;
  error?: string | null | undefined;
}

// A setting in a sheet, as in iOS Settings: a grouped row with a switch, a note under it.
export function SwitchSection({
  label,
  checked,
  onChange,
  disabled,
  note,
  error,
}: SwitchSectionProps) {
  const noteId = useId();

  return (
    <section className={styles.section}>
      <GroupedCard>
        <div className={clsx('ring-inside', styles.row)}>
          <span className={styles.label}>{label}</span>
          <Switch
            checked={checked}
            disabled={disabled}
            onChange={onChange}
            aria-label={label}
            aria-describedby={note ? noteId : undefined}
          />
        </div>
      </GroupedCard>
      {note && (
        <p id={noteId} className={styles.note}>
          {note}
        </p>
      )}
      {error && (
        <p role="alert" className={clsx(styles.error, 'fade-in')}>
          {error}
        </p>
      )}
    </section>
  );
}
