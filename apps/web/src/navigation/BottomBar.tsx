import type { ReactNode } from 'react';
import { useIsPhone } from '../lib/media';
import styles from './BottomBar.module.css';
import { useRegisterBottomBar } from './bottomBarStore';
import { useOptionalScreen } from './ScreenContext';
import { useEditingText } from './useEditingText';

export interface BottomBarProps {
  children: ReactNode;
}

export function BottomBar({ children }: BottomBarProps) {
  const isPhone = useIsPhone();
  const isTop = useOptionalScreen()?.isTop ?? true;
  // The keyboard covers the bar anyway; sliding it away keeps it off the field being edited.
  const editing = useEditingText();
  useRegisterBottomBar(isPhone && isTop && !editing);
  if (!isPhone) return null;
  return (
    <div
      className={styles.bar}
      data-bottom-bar=""
      data-hidden={editing || undefined}
      inert={editing}
    >
      {children}
    </div>
  );
}
