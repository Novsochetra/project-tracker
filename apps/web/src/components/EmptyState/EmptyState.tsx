import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Icon } from '../Icon';
import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  text?: ReactNode;
  action?: ReactNode;
  bordered?: boolean;
  className?: string | undefined;
}

export function EmptyState({
  icon,
  title,
  text,
  action,
  bordered = false,
  className,
}: EmptyStateProps) {
  return (
    <div className={clsx(styles.empty, bordered && styles.bordered, className)}>
      <span className={styles.tile}>
        <Icon icon={icon} size={20} />
      </span>
      <p className={styles.title}>{title}</p>
      {text && <p className={styles.text}>{text}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
