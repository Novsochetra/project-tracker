import { ArrowDown } from 'lucide-react';
import { useEffect, useState, type RefObject } from 'react';
import { Icon, useToastShowing } from '../../../components';
import { useEditingText, useOptionalScreen } from '../../../navigation';
import styles from './CommentJump.module.css';
import { isFarBelow, NEAR_MARGIN } from './farBelow';
import { jumpToComment } from './jumpToComment';
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

// Sits above the phone's bottom bar while Move to Done takes the bar and the comment box is far
// below, as on a ticket with long comments, once the reader has scrolled down a little: on the
// first screen it covered the ends of the description's lines. It leaves the spot to a toast,
// which shows there, and goes with the bar while a field is edited: sliding the bar away would
// only bring it down to where the bar was.
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
      onClick={() => jumpToComment(boxRef.current)}
    >
      <Icon icon={ArrowDown} size={14} className={styles.arrow} />
      Comment
    </button>
  );
}
