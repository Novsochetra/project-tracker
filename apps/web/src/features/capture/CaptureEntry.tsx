import clsx from 'clsx';
import { CloudUpload, Plus } from 'lucide-react';
import { Button, Icon } from '../../components';
import { BottomBar } from '../../navigation';
import styles from './CaptureEntry.module.css';
import { useWaitingCount } from './queueStore';

export function CaptureButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="primary" icon={Plus} aria-keyshortcuts="C" onClick={onClick}>
      New ticket
      <kbd className={styles.key} aria-hidden="true">
        C
      </kbd>
    </Button>
  );
}

export function CaptureBar({ onClick }: { onClick: () => void }) {
  return (
    <BottomBar>
      <Button variant="primary" size="bar" icon={Plus} fullWidth onClick={onClick}>
        New ticket
      </Button>
    </BottomBar>
  );
}

export function WaitingToSync() {
  const count = useWaitingCount();
  if (count === 0) return null;
  return (
    <p className={clsx(styles.waiting, 'fade-in')}>
      <Icon icon={CloudUpload} size={14} />
      {count} waiting to sync
    </p>
  );
}
