import { useLayoutEffect, useRef } from 'react';
import type { UploadingFile } from './useUploadingList';

// Files added (a drop, a paste) land past the fold, so it opens for each new one, before paint.
// Only for new ones: Show less still folds it while they upload.
export function useOpenForNewUploads(uploading: readonly UploadingFile[], open: () => void): void {
  const seen = useRef(new Set<string>());
  useLayoutEffect(() => {
    const fresh = uploading.filter((file) => !seen.current.has(file.key));
    fresh.forEach((file) => seen.current.add(file.key));
    if (fresh.length > 0) open();
  }, [uploading, open]);
}
