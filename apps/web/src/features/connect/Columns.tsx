import type { ReactNode } from 'react';
import styles from './ConnectSheet.module.css';

export interface ColumnsProps {
  aside: ReactNode;
  main: ReactNode;
}

export function Columns({ aside, main }: ColumnsProps) {
  return (
    <div className={styles.layout}>
      <div className={styles.columns}>
        <div className={styles.column}>{aside}</div>
        <div className={styles.column}>{main}</div>
      </div>
    </div>
  );
}
