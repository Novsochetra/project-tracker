import { Icon } from '../../components';
import { stepIcon } from '../steps/stepIcon';
import { CodeLines } from './CodeLines';
import { HIDDEN_CHARS_TEXT, LABEL_CUT_TEXT } from './copy';
import { hasHidden } from './hiddenChars';
import { MarkedText } from './MarkedText';
import styles from './Requests.module.css';
import { labelParts } from './requestText';

// Every line of a command shows, since the person decides on it; one the helper had to cut says so.
export function RequestAction({ label, cut }: { label: string; cut: boolean }) {
  const { verb, detail } = labelParts(label);
  return (
    <div className={styles.action}>
      <p className={styles.verb}>
        <Icon icon={stepIcon({ kind: 'tool', label })} size={16} className={styles.verbIcon} />
        <span className={styles.verbText}>
          <MarkedText text={verb} />
        </span>
      </p>
      {detail && <CodeLines text={detail} />}
      {hasHidden(label) && <p className={styles.cut}>{HIDDEN_CHARS_TEXT}</p>}
      {cut && <p className={styles.cut}>{LABEL_CUT_TEXT}</p>}
    </div>
  );
}
