import { useId } from 'react';
import { usePlanUsage } from '../../api/hooks/planUsage';
import { GroupedCard } from '../../components';
import { useNow } from '../../lib/useNow';
import styles from './ClaudeUsage.module.css';
import { HelperUsageRow } from './HelperUsageRow';

export const USAGE_NOTE =
  'What Claude Code on each computer last said about your Claude plan, while it worked on a run.';

export function ClaudeUsageSection() {
  const usage = usePlanUsage();
  const now = useNow();
  const headingId = useId();
  if (!usage.data?.length) return null;
  return (
    <section aria-labelledby={headingId} className={styles.section}>
      <h2 id={headingId} className={styles.heading}>
        Claude usage
      </h2>
      <GroupedCard>
        <ul className={styles.rows} aria-labelledby={headingId}>
          {usage.data.map((helper) => (
            <HelperUsageRow key={helper.runnerId} usage={helper} now={now} />
          ))}
        </ul>
      </GroupedCard>
      <p className={styles.note}>{USAGE_NOTE}</p>
    </section>
  );
}
