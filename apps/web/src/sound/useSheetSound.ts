import { useEffect, useRef } from 'react';
import { playSound } from './play';

// A sheet sounds as it comes up and as it goes, however it was closed: a button, a swipe down, Esc
// or the scrim. One mounted already closed stays quiet.
export function useSheetSound(open: boolean): void {
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open === wasOpen.current) return;

    wasOpen.current = open;
    playSound(open ? 'sheetOpen' : 'sheetClose');
  }, [open]);
}
