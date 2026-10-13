import { Copy } from 'lucide-react';
import { IconButton } from '../../components';
import styles from './ConnectSheet.module.css';

export interface CommandRowProps {
  command: string;
  description: string;
  copyLabel: string;
  onCopy: (command: string) => void;
  step?: number;
  wraps?: boolean;
}

export function CommandRow(props: CommandRowProps) {
  const { command, description, copyLabel, onCopy, step, wraps = false } = props;
  return (
    <li className={styles.row}>
      {step !== undefined && (
        <span className={styles.stepNumber} aria-hidden="true">
          {step}
        </span>
      )}
      <span className={styles.rowText}>
        <span className={styles.commandBox}>
          <code className={wraps ? `${styles.rowCommand} ${styles.wraps}` : styles.rowCommand}>
            {command}
          </code>
        </span>
        <span className={styles.rowDescription}>{description}</span>
      </span>
      <IconButton icon={Copy} size="sm" aria-label={copyLabel} onClick={() => onCopy(command)} />
    </li>
  );
}
