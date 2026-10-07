import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './NavBarButton.module.css';

export interface NavBarButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string;
  children: ReactNode;
}

export function NavBarButton({ className, children, ...rest }: NavBarButtonProps) {
  return (
    <button type="button" className={clsx(styles.button, 'press', className)} {...rest}>
      {children}
    </button>
  );
}

export function NavBarSpacer() {
  return <span className={styles.spacer} aria-hidden="true" />;
}
