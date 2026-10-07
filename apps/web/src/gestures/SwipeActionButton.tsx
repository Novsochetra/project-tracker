import clsx from 'clsx';
import { motion, useTransform, type MotionValue } from 'motion/react';
import styles from './SwipeActions.module.css';
import { actionEdge, actionLabelOffset, type SwipeSide } from './swipeActionsMath';
import type { SwipeAction } from './swipeTypes';

export interface SwipeActionButtonProps {
  action: SwipeAction;
  index: number;
  count: number;
  side: SwipeSide;
  x: MotionValue<number>;
  full: MotionValue<number>;
  onPress: (action: SwipeAction) => void;
}

// Each button is a full-width strip parked just outside the row; translating it in by its
// share of the revealed width keeps every frame a transform.
export function SwipeActionButton({
  action,
  index,
  count,
  side,
  x,
  full,
  onPress,
}: SwipeActionButtonProps) {
  const sign = side === 'leading' ? 1 : -1;
  const reveal = useTransform(x, (value) => Math.max(0, value * sign));
  const shift = useTransform<number, number>(
    [reveal, full],
    (values) => sign * actionEdge(values[0] ?? 0, index, count, values[1] ?? 0),
  );
  const labelShift = useTransform<number, number>(
    [reveal, full],
    (values) => -sign * actionLabelOffset(values[0] ?? 0, index, count, values[1] ?? 0),
  );
  return (
    <motion.button
      type="button"
      className={clsx(styles.action, styles[action.tone])}
      style={{ x: shift, zIndex: count - index }}
      onClick={() => onPress(action)}
    >
      <motion.span className={styles.label} style={{ x: labelShift }}>
        {action.icon}
        <span>{action.label}</span>
      </motion.span>
    </motion.button>
  );
}
