import clsx from 'clsx';
import type { ReactNode } from 'react';
import styles from './PropertyRow.module.css';

export interface InfoRowProps {
  label: string;
  children: ReactNode;
  className?: string | undefined;
}

export function InfoRow({ label, children, className }: InfoRowProps) {
  return (
    <div className={clsx(styles.info, className)}>
      <span className={styles.infoLabel}>{label}</span>
      <span className={styles.infoValue}>{children}</span>
    </div>
  );
}
