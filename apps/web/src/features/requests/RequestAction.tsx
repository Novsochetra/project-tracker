import { stepIcon } from '../steps/stepIcon';
import { Icon } from '../../components';
import styles from './Requests.module.css';
import { labelParts } from './requestText';

// A command or a path shows whole, never cut, since the person decides on it.
export function RequestAction({ label }: { label: string }) {
  const { verb, detail } = labelParts(label);
  return (
    <div className={styles.action}>
      <p className={styles.verb}>
        <Icon icon={stepIcon({ kind: 'tool', label })} size={16} className={styles.verbIcon} />
        {verb}
      </p>
      {detail && <code className={styles.code}>{detail}</code>}
    </div>
  );
}
