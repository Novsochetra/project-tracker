import clsx from 'clsx';
import { motion, type MotionValue } from 'motion/react';
import { useRef, type ReactNode } from 'react';
import { SwipeActionButton } from './SwipeActionButton';
import styles from './SwipeActions.module.css';
import './tokens.css';
import type { SwipeSide } from './swipeActionsMath';
import type { SwipeAction } from './swipeTypes';
import { useSwipeRow } from './useSwipeRow';

export interface SwipeActionsProps {
  leading?: SwipeAction[];
  trailing?: SwipeAction[];
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}

interface StripProps {
  side: SwipeSide;
  actions: SwipeAction[];
  open: boolean;
  x: MotionValue<number>;
  full: MotionValue<number>;
  onPress: (action: SwipeAction) => void;
}

function ActionStrip({ side, actions, open, x, full, onPress }: StripProps) {
  return (
    <div
      className={clsx(styles.strip, styles[side])}
      inert={!open}
      aria-hidden={open ? undefined : true}
    >
      {actions.map((action, index) => (
        <SwipeActionButton
          key={action.label}
          action={action}
          index={index}
          count={actions.length}
          side={side}
          x={x}
          full={full}
          onPress={onPress}
        />
      ))}
    </div>
  );
}

const NONE: SwipeAction[] = [];

export function SwipeActions({
  leading = NONE,
  trailing = NONE,
  children,
  disabled = false,
  className,
}: SwipeActionsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const row = useSwipeRow({ rootRef, contentRef, leading, trailing, disabled });
  const strip = { x: row.x, full: row.full, onPress: row.press };
  return (
    <div
      ref={rootRef}
      className={clsx(styles.root, className)}
      data-swipe-row=""
      data-swipe-open={row.openSide ?? undefined}
    >
      {leading.length > 0 && (
        <ActionStrip
          side="leading"
          actions={leading}
          open={row.openSide === 'leading'}
          {...strip}
        />
      )}
      {trailing.length > 0 && (
        <ActionStrip
          side="trailing"
          actions={trailing}
          open={row.openSide === 'trailing'}
          {...strip}
        />
      )}
      <motion.div
        ref={contentRef}
        className={styles.content}
        style={{ x: row.x }}
        onClickCapture={row.onContentClick}
      >
        {children}
      </motion.div>
    </div>
  );
}
