import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Icon } from '../Icon';
import styles from './PropertyRow.module.css';

export interface PropertyRowProps extends Omit<ComponentProps<'button'>, 'value' | 'children'> {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}

export function PropertyRow({ icon, label, value, className, ...rest }: PropertyRowProps) {
  return (
    <button type="button" className={clsx('ring-inside', styles.row, className)} {...rest}>
      <span className={styles.icon}>{icon}</span>
      <span className={styles.label}>{label}</span> <span className={styles.value}>{value}</span>
      <Icon icon={ChevronDown} className={styles.chevron} />
    </button>
  );
}
