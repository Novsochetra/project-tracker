import { useEffect, useRef, useSyncExternalStore, type RefObject } from 'react';
import { useIsPhone } from '../lib/media';
import { NO_LARGE_TITLE, type LargeTitleSnapshot } from './largeTitleStore';
import { useOptionalScreen } from './ScreenContext';

const VISIBLE_RATIO = 0.5;
const noop = () => () => undefined;

function observeTitle(
  title: HTMLElement,
  root: HTMLElement | null,
  onChange: (visible: boolean) => void,
) {
  const navBar = root?.querySelector<HTMLElement>('[data-navbar]');
  const observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[entries.length - 1];
      if (entry) onChange(entry.isIntersecting && entry.intersectionRatio >= VISIBLE_RATIO);
    },
    {
      root,
      // The title counts as gone once it slides under the translucent nav bar.
      rootMargin: `-${navBar?.offsetHeight ?? 0}px 0px 0px 0px`,
      threshold: [0, VISIBLE_RATIO, 1],
    },
  );
  observer.observe(title);
  return () => observer.disconnect();
}

export function useLargeTitle<T extends HTMLElement>(): RefObject<T | null> {
  const ref = useRef<T>(null);
  const screen = useOptionalScreen();
  const isPhone = useIsPhone();
  useEffect(() => {
    const store = screen?.largeTitle;
    const title = ref.current;
    if (!store || !title || !isPhone) return;
    store.set({ present: true, visible: true });
    const stop =
      typeof IntersectionObserver === 'undefined'
        ? () => undefined
        : observeTitle(title, screen.scrollRef.current, (visible) => {
            store.set({ present: true, visible });
          });
    return () => {
      stop();
      store.set(NO_LARGE_TITLE);
    };
  }, [screen, isPhone]);
  return ref;
}

export function useLargeTitleState(): LargeTitleSnapshot {
  const store = useOptionalScreen()?.largeTitle;
  return useSyncExternalStore(
    store?.subscribe ?? noop,
    store?.get ?? (() => NO_LARGE_TITLE),
    () => NO_LARGE_TITLE,
  );
}

export function useLargeTitleCollapsed(): boolean {
  const { present, visible } = useLargeTitleState();
  return present && !visible;
}
