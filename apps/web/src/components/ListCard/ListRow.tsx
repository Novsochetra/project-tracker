import clsx from 'clsx';
import type { ComponentProps } from 'react';
import styles from './ListCard.module.css';

export type ListRowProps = ComponentProps<'button'>;

export function ListRow({ className, ...rest }: ListRowProps) {
  return <button type="button" className={clsx('ring-inside', styles.row, className)} {...rest} />;
}
