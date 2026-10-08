import { useRef, type ReactNode } from 'react';
import { useIsPhone } from '../lib/media';
import styles from './BottomBar.module.css';
import { useRegisterBottomBar } from './bottomBarStore';
import { useKeepFieldInSight, useKeepSentFormInSight } from './keepFieldInSight';
import { useOptionalScreen } from './ScreenContext';
import { useEditingText } from './useEditingText';

export interface BottomBarProps {
  children: ReactNode;
}

export function BottomBar({ children }: BottomBarProps) {
  const isPhone = useIsPhone();
  const screen = useOptionalScreen();
  const isTop = screen?.isTop ?? true;
  // The keyboard covers the bar anyway; sliding it away keeps it off the field being edited.
  const editing = useEditingText();
  const barRef = useRef<HTMLDivElement>(null);
  useRegisterBottomBar(isPhone && isTop && !editing);
  useKeepFieldInSight(barRef, screen?.scrollRef, editing);
  useKeepSentFormInSight(barRef, screen?.scrollRef, isPhone && isTop);
  if (!isPhone) return null;
  return (
    <div
      ref={barRef}
      className={styles.bar}
      data-bottom-bar=""
      data-hidden={editing || undefined}
      inert={editing}
    >
      {children}
    </div>
  );
}
