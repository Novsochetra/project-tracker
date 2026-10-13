import { m, useMotionValue, useTransform } from 'motion/react';
import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { usePrefersReducedMotion } from '../lib/media';
import { MotionScope } from '../lib/MotionScope';
import { spring } from './animation';
import { haptic } from './haptics';
import styles from './PullToRefresh.module.css';
import { crossedThreshold, PULL_HOLD, pullDistance, pullProgress, shouldRefresh } from './pullMath';
import { RefreshSpinner } from './RefreshSpinner';
import './tokens.css';
import { useTopPull } from './useTopPull';

export interface PullToRefreshProps {
  onRefresh: () => Promise<unknown>;
  scrollRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  disabled?: boolean;
}

const SETTLE = { visualDuration: 0.35, restDelta: 0.5 };

export function PullToRefresh({
  onRefresh,
  scrollRef,
  children,
  disabled = false,
}: PullToRefreshProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const lastRef = useRef(0);
  const onRefreshRef = useRef(onRefresh);
  useLayoutEffect(() => {
    onRefreshRef.current = onRefresh;
  });
  const [refreshing, setRefreshing] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const pull = useMotionValue(0);
  const progress = useTransform(pull, pullProgress);
  const spinnerY = useTransform(pull, (distance) => Math.max(0, distance / 2));

  const settle = (target: number) => {
    if (reducedMotion) pull.set(target);
    else spring(pull, target, SETTLE);
  };
  const refresh = () => {
    setRefreshing(true);
    settle(PULL_HOLD);
    void Promise.resolve()
      .then(() => onRefreshRef.current())
      .catch(() => undefined)
      .finally(() => {
        setRefreshing(false);
        settle(0);
      });
  };

  useTopPull(rootRef, {
    enabled: !disabled && !refreshing,
    scrollRef,
    onStart: () => {
      pull.stop();
      lastRef.current = 0;
    },
    onMove: (dy) => {
      const distance = pullDistance(dy);
      if (crossedThreshold(lastRef.current, distance) && shouldRefresh(distance)) haptic('light');
      lastRef.current = distance;
      pull.set(distance);
    },
    onEnd: () => {
      if (shouldRefresh(pull.get())) refresh();
      else settle(0);
    },
  });

  return (
    <MotionScope>
      <div ref={rootRef} className={styles.root} data-refreshing={refreshing || undefined}>
        <m.div
          className={styles.indicator}
          style={{ y: spinnerY, opacity: progress }}
          aria-hidden="true"
        >
          <RefreshSpinner progress={progress} spinning={refreshing} />
        </m.div>
        <m.div className={styles.content} style={{ y: pull }}>
          {children}
        </m.div>
        <span role="status" className="visually-hidden">
          {refreshing ? 'Refreshing' : ''}
        </span>
      </div>
    </MotionScope>
  );
}
