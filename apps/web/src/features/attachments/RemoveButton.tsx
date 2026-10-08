import { X } from 'lucide-react';
import { Icon } from '../../components';
import styles from './ThumbnailGrid.module.css';

export function RemoveButton({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      className={styles.remove}
      aria-label={label}
      onClick={(event) => {
        // Safari doesn't focus a tapped button, and a confirm hands focus back to what had it
        // when it opened.
        event.currentTarget.focus({ preventScroll: true });
        onRemove();
      }}
    >
      <Icon icon={X} size={14} />
    </button>
  );
}
