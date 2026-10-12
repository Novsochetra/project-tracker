import { prefersReducedMotionNow } from '../lib/media';

export function scrollScreenToTop(scroller: HTMLElement): void {
  scroller.scrollTo({ top: 0, behavior: prefersReducedMotionNow() ? 'instant' : 'smooth' });
}
