import { Copy } from 'lucide-react';
import { IconButton } from '../../components';
import styles from './ConnectSheet.module.css';

export interface CommandRowProps {
  command: string;
  description: string;
  copyLabel: string;
  onCopy: (command: string) => void;
  step?: number;
}

export function CommandRow({ command, description, copyLabel, onCopy, step }: CommandRowProps) {
  return (
    <li className={styles.row}>
      {step !== undefined && (
        <span className={styles.stepNumber} aria-hidden="true">
          {step}
        </span>
      )}
      <span className={styles.rowText}>
        <span className={styles.commandBox}>
          <code className={styles.rowCommand}>{command}</code>
        </span>
        <span className={styles.rowDescription}>{description}</span>
      </span>
      <IconButton icon={Copy} size="sm" aria-label={copyLabel} onClick={() => onCopy(command)} />
    </li>
  );
}
