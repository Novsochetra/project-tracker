import clsx from 'clsx';
import styles from './ClaudeUsage.module.css';
import type { UsageMeter } from './planUsageText';

const FULL = 100;

export function UsageMeterLine({ meter }: { meter: UsageMeter }) {
  const { name, usedPercent, detail } = meter;
  return (
    <span className={styles.meter}>
      <span className={styles.meterText}>
        <span className={styles.meterName}>{name}</span>
        <span className={styles.meterDetail}>{detail}</span>
      </span>
      {usedPercent !== null && (
        <span
          role="meter"
          aria-label={`${name} used`}
          aria-valuemin={0}
          aria-valuemax={FULL}
          aria-valuenow={Math.min(usedPercent, FULL)}
          className={styles.track}
        >
          <span
            className={clsx(styles.fill, usedPercent >= FULL && styles.full)}
            style={{ width: `${Math.min(usedPercent, FULL)}%` }}
          />
        </span>
      )}
    </span>
  );
}
