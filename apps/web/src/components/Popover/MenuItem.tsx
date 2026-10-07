import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Icon } from '../Icon';
import styles from './Popover.module.css';

export interface MenuItemProps extends ComponentProps<'button'> {
  icon?: LucideIcon | undefined;
  tone?: 'default' | 'danger';
}

export function MenuItem({ icon, tone = 'default', className, children, ...rest }: MenuItemProps) {
  return (
    <button
      type="button"
      className={clsx('ring-inside', styles.item, tone === 'danger' && styles.danger, className)}
      {...rest}
    >
      {icon && <Icon icon={icon} />}
      {children}
    </button>
  );
}
