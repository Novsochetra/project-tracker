import { prefersReducedMotionNow } from '../../../lib/media';

// Focus comes first, inside the tap: iOS opens the keyboard only for a focus the tap itself made.
// The bar then slides away as for any field (docs/architecture.md §1.5).
export function jumpToComment(box: HTMLFormElement | null): void {
  const field = box?.querySelector('textarea');
  if (!box || !field) return;

  field.focus({ preventScroll: true });
  box.scrollIntoView({
    block: 'center',
    behavior: prefersReducedMotionNow() ? 'instant' : 'smooth',
  });
}
