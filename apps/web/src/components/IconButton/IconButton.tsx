import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Icon } from '../Icon';
import styles from './IconButton.module.css';

export interface IconButtonProps extends Omit<ComponentProps<'button'>, 'children' | 'aria-label'> {
  'aria-label': string;
  icon: LucideIcon;
  size?: 'md' | 'sm' | 'xs';
  tone?: 'muted' | 'ink';
}

export function IconButton({
  icon,
  size = 'md',
  tone = 'muted',
  className,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={clsx(styles.button, styles[size], styles[tone], className)}
      {...rest}
    >
      <Icon icon={icon} className={styles.icon} />
    </button>
  );
}
