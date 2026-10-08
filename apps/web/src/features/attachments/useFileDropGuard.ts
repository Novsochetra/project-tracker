import { useEffect } from 'react';
import { carriesFiles } from './attachmentFiles';

// A file dropped where no drop zone takes it would open in the browser and leave the app, losing
// unsent text. Drop zones cancel their own events first, so only unclaimed file drags get here.
function refuseStrayFileDrop(event: DragEvent) {
  if (event.defaultPrevented || !carriesFiles(event.dataTransfer)) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
}

/** Keeps files dropped outside the drop zones from opening in the browser. Use once, at the root. */
export function useFileDropGuard(): void {
  useEffect(() => {
    window.addEventListener('dragover', refuseStrayFileDrop);
    window.addEventListener('drop', refuseStrayFileDrop);
    return () => {
      window.removeEventListener('dragover', refuseStrayFileDrop);
      window.removeEventListener('drop', refuseStrayFileDrop);
    };
  }, []);
}
