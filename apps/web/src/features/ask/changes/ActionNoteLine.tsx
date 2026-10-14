import type { ChatGitAction } from '@tracker/shared';
import clsx from 'clsx';
import { actionNote } from './actionNote';
import styles from './ChatChanges.module.css';

export function ActionNoteLine({ action }: { action: ChatGitAction | null }) {
  const note = actionNote(action);
  if (!note) return null;
  return (
    <p
      role={note.tone === 'failed' ? 'alert' : 'status'}
      className={clsx(styles.note, note.tone === 'failed' && styles.failed)}
    >
      {note.text}
      {note.url && (
        <>
          {' '}
          <a className={styles.link} href={note.url} target="_blank" rel="noreferrer">
            {note.url}
          </a>
        </>
      )}
    </p>
  );
}
