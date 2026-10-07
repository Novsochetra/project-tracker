import clsx from 'clsx';
import type { ComponentProps } from 'react';
import styles from './GroupedCard.module.css';

export interface GroupedCardProps extends ComponentProps<'div'> {
  dense?: boolean;
}

export function GroupedCard({ dense = false, className, ...rest }: GroupedCardProps) {
  return <div className={clsx(styles.card, dense && styles.dense, className)} {...rest} />;
}
