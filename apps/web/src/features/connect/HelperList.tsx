import { toolsText } from '@tracker/shared';
import { useRunners } from '../../api/hooks/runs';
import { GroupedCard } from '../../components';
import { useNow } from '../../lib/useNow';
import shared from './ConnectSheet.module.css';
import { helperDetails } from './helperText';
import styles from './HelperList.module.css';

export function HelperList() {
  const runners = useRunners();
  const now = useNow();
  if (!runners.data) return null;
  if (runners.data.length === 0) return <p className={shared.note}>No computers yet.</p>;
  return (
    <GroupedCard>
      <ul className={shared.rows} aria-label="Your computers">
        {runners.data.map((runner) => (
          <li key={runner.id} className={shared.row}>
            <span className={shared.rowText}>
              <span className={styles.name}>{runner.name}</span>
              <span className={shared.rowDescription}>{helperDetails(runner, now)}</span>
              <HelperTools text={toolsText(runner.tools)} />
            </span>
          </li>
        ))}
      </ul>
    </GroupedCard>
  );
}

function HelperTools({ text }: { text: string }) {
  if (!text) return null;
  return <span className={shared.rowDescription}>{text}</span>;
}
