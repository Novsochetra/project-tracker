import { ArrowDown } from 'lucide-react';
import { useEffect, useState, type RefObject } from 'react';
import { Icon, useToastShowing } from '../../../components';
import { prefersReducedMotionNow } from '../../../lib/media';
import { useEditingText, useOptionalScreen } from '../../../navigation';
import styles from './CommentJump.module.css';
import { isFarBelow, NEAR_MARGIN } from './farBelow';
import { isScrolledDown } from './scrolledDown';

type BoxRef = RefObject<HTMLFormElement | null>;
type ScrollerRef = RefObject<HTMLElement | null> | undefined;

function useFarBelow(box: BoxRef, scroller: ScrollerRef): boolean {
  const [far, setFar] = useState(false);
  useEffect(() => {
    const target = box.current;
    const root = scroller?.current;
    if (!target || !root || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        const { isIntersecting, boundingClientRect, rootBounds } = entry;
        const rootBottom = rootBounds ? rootBounds.bottom : null;
        setFar(
          isFarBelow({ intersecting: isIntersecting, top: boundingClientRect.top, rootBottom }),
        );
      },
      { root, rootMargin: NEAR_MARGIN },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [box, scroller]);
  return far;
}

function useScrolledDown(scroller: ScrollerRef): boolean {
  const [down, setDown] = useState(false);
  useEffect(() => {
    const root = scroller?.current;
    if (!root) return;
    const update = () => setDown(isScrolledDown(root.scrollTop, root.clientHeight));
    root.addEventListener('scroll', update, { passive: true });
    return () => root.removeEventListener('scroll', update);
  }, [scroller]);
  return down;
}

// Focus comes first, inside the tap: iOS opens the keyboard only for a focus the tap itself made.
// The bar then slides away as for any field (docs/architecture.md §1.5).
function jumpTo(box: HTMLFormElement | null): void {
  const field = box?.querySelector('textarea');
  if (!box || !field) return;
  field.focus({ preventScroll: true });
  box.scrollIntoView({
    block: 'center',
    behavior: prefersReducedMotionNow() ? 'instant' : 'smooth',
  });
}

// Sits above the phone's bottom bar while the comment box is far below, as on a ticket with long
// comments, once the reader has scrolled down a little: on the first screen it covered the ends
// of the description's lines. It leaves the spot to a toast, which shows there, and goes with the
// bar while a field is edited: sliding the bar away would only bring it down to where the bar was.
export function CommentJump({ boxRef }: { boxRef: BoxRef }) {
  const screen = useOptionalScreen();
  const far = useFarBelow(boxRef, screen?.scrollRef);
  const down = useScrolledDown(screen?.scrollRef);
  const toastShowing = useToastShowing();
  const editing = useEditingText();
  if (!far || !down || toastShowing || editing) return null;
  return (
    <button
      type="button"
      className={styles.jump}
      aria-label="Go to the comment box"
      onClick={() => jumpTo(boxRef.current)}
    >
      <Icon icon={ArrowDown} size={14} className={styles.arrow} />
      Comment
    </button>
  );
}
