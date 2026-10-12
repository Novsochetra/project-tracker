import { useEffect, type RefObject } from 'react';
import { isIOS } from '../lib/platform';
import { isBodyScrollLocked } from '../overlays/scrollLock';
import { scrollScreenToTop } from './scrollToTop';
import { watchStatusBarTap } from './statusBarTap';

const TOP_SCROLLER = ':scope > :not([inert]) > [data-stack-scroller]';

// Only iOS scrolls the page on a status-bar tap; elsewhere the page keeps no scroll range, so a
// desktop never shows a scrollbar for it (base.css).
export function useStatusBarTap(rootRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    if (!isIOS()) return;
    const html = document.documentElement;
    html.dataset.statusBarTap = '';
    const stop = watchStatusBarTap(window, {
      isLocked: isBodyScrollLocked,
      onTap: () => {
        const scroller = rootRef.current?.querySelector<HTMLElement>(TOP_SCROLLER);
        if (scroller) scrollScreenToTop(scroller);
      },
    });
    return () => {
      stop();
      delete html.dataset.statusBarTap;
    };
  }, [rootRef]);
}
