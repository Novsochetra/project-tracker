import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './SheetButtons.module.css';
import { useSheetCancel } from './sheetCancel';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function SheetTextButton({ className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={clsx(styles.text, className)} {...rest} />;
}

export function SheetActionButton({ className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={clsx(styles.action, 'press', className)} {...rest} />;
}

export function SheetCancelButton({ children = 'Cancel' }: { children?: ReactNode }) {
  const cancel = useSheetCancel();
  return <SheetTextButton onClick={cancel}>{children}</SheetTextButton>;
}
