import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

// Marks Escape as handled inside the element, so the sheet around it stays open.
export function useEscapeKey(ref: RefObject<HTMLElement | null>, onEscape: () => void): void {
  const latest = useRef(onEscape);
  useLayoutEffect(() => {
    latest.current = onEscape;
  });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      latest.current();
    };
    element.addEventListener('keydown', onKeyDown);
    return () => element.removeEventListener('keydown', onKeyDown);
  }, [ref]);
}
