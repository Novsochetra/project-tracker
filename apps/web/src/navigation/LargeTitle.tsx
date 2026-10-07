import type { ReactNode } from 'react';
import styles from './LargeTitle.module.css';
import { useLargeTitle } from './useLargeTitle';

export interface LargeTitleProps {
  children: ReactNode;
  aside?: ReactNode;
}

export function LargeTitle({ children, aside }: LargeTitleProps) {
  const ref = useLargeTitle<HTMLHeadingElement>();
  return (
    <div className={styles.row}>
      <h1 ref={ref} className={styles.title}>
        {children}
      </h1>
      {aside !== undefined && <span className={styles.aside}>{aside}</span>}
    </div>
  );
}
