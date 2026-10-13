import clsx from 'clsx';
import { GroupedCard } from '../../components';
import { Switch } from '../../components/Switch';
import styles from './NotificationsSection.module.css';
import { PUSH_NOTES } from './pushNotes';
import { usePushSwitch } from './usePushSwitch';

const LABEL = 'Notifications on this device';

export function NotificationsSection() {
  const { device, pending, error, toggle } = usePushSwitch();
  const ready = device?.support === 'ready';
  return (
    <section className={styles.section}>
      <GroupedCard>
        <div className={clsx('ring-inside', styles.row)}>
          <span className={styles.label}>{LABEL}</span>
          <Switch
            checked={device?.on ?? false}
            disabled={!ready || pending}
            onChange={toggle}
            aria-label={LABEL}
          />
        </div>
      </GroupedCard>
      {device && <p className={styles.note}>{PUSH_NOTES[device.support]}</p>}
      {error && (
        <p role="alert" className={clsx(styles.error, 'fade-in')}>
          {error}
        </p>
      )}
    </section>
  );
}
