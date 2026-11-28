import { prefersReducedMotionNow } from '../lib/media';

type StartViewTransition = (update: () => void) => unknown;

// A change of appearance cross-fades the whole screen, as iOS does, instead of colors snapping.
// Reduced motion, a hidden page or a browser without view transitions changes at once.
export function crossFade(document: Document, update: () => void): void {
  const start = (document as { startViewTransition?: StartViewTransition }).startViewTransition;
  if (!start || prefersReducedMotionNow() || document.visibilityState !== 'visible') {
    update();

    return;
  }

  start.call(document, update);
}
