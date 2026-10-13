import { domMin, LazyMotion } from 'motion/react';
import type { ReactNode } from 'react';

// Our `m` elements only follow motion values, so they render with domMin's renderer; `motion`
// elements carry drag, layout and gestures too, 14.5 kB of the first load (PT-207).
export function MotionScope({ children }: { children: ReactNode }) {
  return <LazyMotion features={domMin}>{children}</LazyMotion>;
}
