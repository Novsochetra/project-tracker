import type { RunQuestionOption } from '@tracker/shared';
import styles from './Requests.module.css';

export function ChoiceText({ option, id }: { option: RunQuestionOption; id: string }) {
  return (
    <span className={styles.choiceText}>
      <span id={`${id}-label`} className={styles.choiceLabel}>
        {option.label}
      </span>
      {option.description && (
        <span id={`${id}-description`} className={styles.choiceDescription}>
          {option.description}
        </span>
      )}
    </span>
  );
}
