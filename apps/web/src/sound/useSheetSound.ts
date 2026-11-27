import { useEffect, useRef } from 'react';
import { playSound } from './play';

interface SheetSoundOptions {
  // An action sheet closes because a choice was made, and the choice sounds itself (a move, a new
  // sheet), so it only sounds as it comes up.
  onClose?: boolean;
}

// A sheet sounds as it comes up and as it goes, however it was closed: a button, a swipe down, Esc
// or the scrim. One mounted already closed stays quiet.
export function useSheetSound(open: boolean, { onClose = true }: SheetSoundOptions = {}): void {
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open === wasOpen.current) return;

    wasOpen.current = open;
    if (open) playSound('sheetOpen');
    else if (onClose) playSound('sheetClose');
  }, [open, onClose]);
}
