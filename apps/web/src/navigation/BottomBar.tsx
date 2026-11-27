import clsx from 'clsx';
import { useRef, type ReactNode } from 'react';
import { useIsPhone } from '../lib/media';
import styles from './BottomBar.module.css';
import { useRegisterBottomBar } from './bottomBarStore';
import { useKeepFieldInSight, useKeepSentFormInSight } from './keepFieldInSight';
import { useOptionalScreen } from './ScreenContext';
import { useEditingText } from './useEditingText';

export interface BottomBarProps {
  children: ReactNode;
  // One round button over the screen's bottom right corner instead of a bar across it.
  floating?: boolean;
}

export function BottomBar({ children, floating = false }: BottomBarProps) {
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
      className={clsx(styles.bar, floating && styles.floating)}
      data-bottom-bar=""
      data-floating={floating || undefined}
      data-hidden={editing || undefined}
      inert={editing}
    >
      {children}
    </div>
  );
}
