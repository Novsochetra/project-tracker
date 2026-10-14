import type { ChatChanges } from '@tracker/shared';
import styles from './ChatChanges.module.css';
import { PR_TITLE_LABEL, pushQuestion } from './copy';

export interface PullRequestConfirmProps {
  changes: ChatChanges;
  title: string;
  onTitle: (title: string) => void;
  error: string | null;
}

// The confirm step: the person sees which branch goes where before anything is pushed.
export function PullRequestConfirm({ changes, title, onTitle, error }: PullRequestConfirmProps) {
  return (
    <div className={styles.body}>
      <p className={styles.question}>{pushQuestion(changes.branch ?? '', changes.defaultBranch)}</p>
      <label className={styles.field}>
        {PR_TITLE_LABEL}
        <input
          className={styles.input}
          value={title}
          onChange={(event) => onTitle(event.currentTarget.value)}
        />
      </label>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
