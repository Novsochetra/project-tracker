import clsx from 'clsx';
import type { HTMLAttributes } from 'react';
import styles from './ListCard.module.css';

export interface ListCardProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section';
  variant?: 'list' | 'group';
}

export function ListCard({ as: Tag = 'div', variant = 'list', className, ...rest }: ListCardProps) {
  return (
    <Tag className={clsx(styles.card, variant === 'group' && styles.group, className)} {...rest} />
  );
}
