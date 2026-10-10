import { Icon } from '../../components';
import { stepIcon } from '../steps/stepIcon';
import { LABEL_CUT_TEXT } from './copy';
import styles from './Requests.module.css';
import { labelParts } from './requestText';

// Every line of a command shows, since the person decides on it; one the helper had to cut says so.
export function RequestAction({ label, cut }: { label: string; cut: boolean }) {
  const { verb, detail } = labelParts(label);
  return (
    <div className={styles.action}>
      <p className={styles.verb}>
        <Icon icon={stepIcon({ kind: 'tool', label })} size={16} className={styles.verbIcon} />
        {verb}
      </p>
      {detail && <code className={styles.code}>{detail}</code>}
      {cut && <p className={styles.cut}>{LABEL_CUT_TEXT}</p>}
    </div>
  );
}
