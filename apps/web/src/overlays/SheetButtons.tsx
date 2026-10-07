import clsx from 'clsx';
import type { ButtonHTMLAttributes } from 'react';
import styles from './SheetButtons.module.css';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function SheetTextButton({ className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={clsx(styles.text, className)} {...rest} />;
}

export function SheetActionButton({ className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={clsx(styles.action, 'press', className)} {...rest} />;
}
