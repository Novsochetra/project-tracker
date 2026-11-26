import clsx from 'clsx';
import type { ButtonHTMLAttributes } from 'react';
import { useIsOpening, type Route } from '../navigation';
import styles from './Sidebar.module.css';

export interface SidebarItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  route: Route;
  active: boolean;
}

export function SidebarItem({ route, active, className, children, ...button }: SidebarItemProps) {
  const opening = useIsOpening(route);

  return (
    <button
      type="button"
      className={clsx(styles.item, active && styles.active, className)}
      aria-current={active ? 'page' : undefined}
      data-opening={opening || undefined}
      {...button}
    >
      {children}
    </button>
  );
}
