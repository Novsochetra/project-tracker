import type { HelperPlanUsage } from '@tracker/shared';
import styles from './ClaudeUsage.module.css';
import { planUsageView } from './planUsageText';
import { UsageMeterLine } from './UsageMeterLine';

export interface HelperUsageRowProps {
  usage: HelperPlanUsage;
  now: number;
}

export function HelperUsageRow({ usage, now }: HelperUsageRowProps) {
  const { status, meters, seen } = planUsageView(usage, now);
  return (
    <li className={styles.row} aria-label={usage.runnerName}>
      <span className={styles.name}>{usage.runnerName}</span>
      {status && <span className={styles.status}>{status}</span>}
      {meters.map((meter) => (
        <UsageMeterLine key={meter.name} meter={meter} />
      ))}
      {seen && <span className={styles.seen}>{seen}</span>}
    </li>
  );
}
