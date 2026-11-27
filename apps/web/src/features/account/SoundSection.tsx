import clsx from 'clsx';
import { useId } from 'react';
import { GroupedCard } from '../../components';
import { Switch } from '../../components/Switch';
import { setSoundsOn, useSoundsOn } from '../../sound';
import styles from './SoundSection.module.css';

const LABEL = 'Sounds';

export function SoundSection() {
  const on = useSoundsOn();
  const noteId = useId();

  return (
    <section className={styles.section}>
      <GroupedCard>
        <div className={clsx('ring-inside', styles.row)}>
          <span className={styles.label}>{LABEL}</span>
          <Switch
            checked={on}
            onChange={setSoundsOn}
            aria-label={LABEL}
            aria-describedby={noteId}
          />
        </div>
      </GroupedCard>
      <p id={noteId} className={styles.note}>
        Soft clicks as you switch, drag and move tickets, and a chime when one is done. The
        phone&apos;s silent mode mutes them.
      </p>
    </section>
  );
}
