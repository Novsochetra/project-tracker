import clsx from 'clsx';
import { CircleAlert } from 'lucide-react';
import { Icon } from '../../../components';
import styles from './UnsavedNote.module.css';

export interface NoteAction {
  label: string;
  // The accessible name, when the label alone wouldn't say which field it is for.
  name: string;
  onClick: () => void;
}

export interface UnsavedNoteProps {
  message: string;
  id?: string | undefined;
  actions?: readonly NoteAction[];
  className?: string | undefined;
}

export function UnsavedNote({ message, id, actions = [], className }: UnsavedNoteProps) {
  return (
    <p role="alert" className={clsx(styles.note, 'fade-in', className)}>
      <Icon icon={CircleAlert} size={14} className={styles.icon} />
      <span className={styles.body}>
        <span id={id}>{message}</span>
        {actions.length > 0 && (
          <span className={styles.actions}>
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                className={styles.action}
                aria-label={action.name}
                onClick={action.onClick}
              >
                {action.label}
              </button>
            ))}
          </span>
        )}
      </span>
    </p>
  );
}
