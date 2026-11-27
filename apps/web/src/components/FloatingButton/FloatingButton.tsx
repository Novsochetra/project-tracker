import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import type { ComponentProps } from 'react';
import { Icon } from '../Icon';
import styles from './FloatingButton.module.css';

export interface FloatingButtonProps extends Omit<
  ComponentProps<'button'>,
  'children' | 'aria-label'
> {
  'aria-label': string;
  icon: LucideIcon;
}

// A screen's one main action as a round button floating over its bottom right corner (BottomBar
// floating); its name is spoken, not shown.
export function FloatingButton({ icon, className, ...rest }: FloatingButtonProps) {
  return (
    <button type="button" className={clsx(styles.button, className)} {...rest}>
      <Icon icon={icon} size={24} />
    </button>
  );
}
