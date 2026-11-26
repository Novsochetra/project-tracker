import { useEffect } from 'react';
import { useSheets } from '../../app/sheets/context';
import { hasOpenOverlay } from '../capture/captureTriggers';
import { isApplePlatform, isPaletteShortcut } from './paletteShortcut';

// Works from a text field too: Command-K types nothing. Another sheet or menu keeps its place, so
// its unsaved input isn't thrown away.
export function SearchShortcut() {
  const { open, close, current } = useSheets();
  useEffect(() => {
    const apple = isApplePlatform();
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isPaletteShortcut(event, apple)) return;
      if (current?.type === 'search') {
        event.preventDefault();
        close();
      } else if (current === null && !hasOpenOverlay(document)) {
        event.preventDefault();
        open({ type: 'search' });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, close, current]);
  return null;
}
