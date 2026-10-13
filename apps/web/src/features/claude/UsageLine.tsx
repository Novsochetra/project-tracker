import { runUsageParts, type RunUsage } from '@tracker/shared';
import styles from './UsageLine.module.css';
import { UsageParts } from './UsageParts';

export function UsageLine({ usage }: { usage: RunUsage | null }) {
  const parts = runUsageParts(usage);
  if (parts.length === 0) return null;
  return (
    <p className={styles.usage}>
      <UsageParts parts={parts} />
    </p>
  );
}
