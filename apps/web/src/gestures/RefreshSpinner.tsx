import clsx from 'clsx';
import type { MotionValue } from 'motion/react';
import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import styles from './PullToRefresh.module.css';

const SPOKES = Array.from({ length: 12 }, (_, index) => index);

const spokeStyle = (index: number): CSSProperties =>
  ({ '--spoke': index, transform: `rotate(${index * 30}deg)` }) as CSSProperties;

export interface RefreshSpinnerProps {
  progress: MotionValue<number>;
  spinning: boolean;
}

export function RefreshSpinner({ progress, spinning }: RefreshSpinnerProps) {
  const ref = useRef<SVGSVGElement>(null);
  useLayoutEffect(() => {
    const apply = (value: number) => ref.current?.style.setProperty('--pull', String(value));
    apply(progress.get());
    return progress.on('change', apply);
  }, [progress]);
  return (
    <svg
      ref={ref}
      viewBox="0 0 28 28"
      className={clsx(styles.spinner, spinning && styles.spinning)}
      aria-hidden="true"
      focusable="false"
    >
      {SPOKES.map((index) => (
        <line
          key={index}
          x1="14"
          y1="3"
          x2="14"
          y2="8.5"
          className={styles.spoke}
          style={spokeStyle(index)}
        />
      ))}
    </svg>
  );
}
