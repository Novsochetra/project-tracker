import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { m, useMotionValueEvent, useTransform } from 'motion/react';
import { useState } from 'react';
import { Icon } from '../components';
import { MotionScope } from '../lib/MotionScope';
import styles from './SwipeHint.module.css';
import type { TrackpadSwipeHint } from './useTrackpadSwipe';

const TRAVEL_PX = 56;

// Like the browser's own trackpad swipe arrow: it slides in from the side the page will come from
// and fills when the swipe is far enough to change the page.
export function SwipeHint({ progress, direction }: TrackpadSwipeHint) {
  const [ready, setReady] = useState(false);
  useMotionValueEvent(progress, 'change', (value) => setReady(value >= 1));
  const side = direction === 'forward' ? 1 : -1;
  const x = useTransform(progress, (value) => side * TRAVEL_PX * (1 - value));

  return (
    <MotionScope>
      <m.div
        aria-hidden="true"
        data-swipe-hint={direction ?? undefined}
        className={clsx(
          styles.hint,
          side > 0 ? styles.forward : styles.back,
          ready && styles.ready,
        )}
        style={{ x, opacity: progress }}
      >
        <Icon icon={side > 0 ? ChevronRight : ChevronLeft} size={20} />
      </m.div>
    </MotionScope>
  );
}
