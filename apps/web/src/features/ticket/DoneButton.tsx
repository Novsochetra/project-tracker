import clsx from 'clsx';
import { Check } from 'lucide-react';
import { Button } from '../../components';
import styles from './DoneButton.module.css';
import type { MoveToDone } from './useMoveToDone';

export interface DoneButtonProps {
  done: MoveToDone;
  size: 'lg' | 'bar';
  className?: string | undefined;
}

export function DoneButton({ done, size, className }: DoneButtonProps) {
  return (
    <Button
      variant="primary"
      size={size}
      icon={Check}
      className={clsx(styles.button, className)}
      onClick={done.move}
    >
      <span className={styles.label}>Move to {done.status.name}</span>
    </Button>
  );
}
