import { Copy } from 'lucide-react';
import { IconButton } from '../../components';
import styles from './ConnectSheet.module.css';

export interface CommandRowProps {
  command: string;
  description: string;
  copyLabel: string;
  onCopy: (command: string) => void;
}

export function CommandRow({ command, description, copyLabel, onCopy }: CommandRowProps) {
  return (
    <li className={styles.row}>
      <span className={styles.rowText}>
        <code className={styles.rowCommand}>{command}</code>
        <span className={styles.rowDescription}>{description}</span>
      </span>
      <IconButton icon={Copy} size="sm" aria-label={copyLabel} onClick={() => onCopy(command)} />
    </li>
  );
}
