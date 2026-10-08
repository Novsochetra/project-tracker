import type { AttachmentKind } from '@tracker/shared';
import { useState } from 'react';

export interface UploadingFile {
  key: string;
  name: string;
  kind: AttachmentKind;
  size: number;
  progress: number;
  preview: string | null;
  // It didn't upload: its tile stays and says so (useAttachmentUploads).
  failed: boolean;
}

const PERCENT = 100;

export type TileMatch = (item: UploadingFile) => boolean;

export function useUploadingList() {
  const [tiles, setTiles] = useState<UploadingFile[]>([]);
  const setProgress = (key: string, fraction: number) => {
    // Whole percents, so a fast upload doesn't render on every progress event.
    const progress = Math.round(fraction * PERCENT) / PERCENT;
    setTiles((current) =>
      current.some((item) => item.key === key && item.progress !== progress)
        ? current.map((item) => (item.key === key ? { ...item, progress } : item))
        : current,
    );
  };
  const add = (item: UploadingFile) => setTiles((current) => [...current, item]);
  const fail = (key: string) =>
    setTiles((current) =>
      current.map((item) => (item.key === key ? { ...item, failed: true } : item)),
    );
  // A failed tile shows its preview until it goes; the others' previews go when they settle.
  const drop = (match: TileMatch) => {
    tiles.forEach((item) => {
      if (item.failed && item.preview && match(item)) URL.revokeObjectURL(item.preview);
    });
    setTiles((current) => current.filter((item) => !match(item)));
  };
  return { tiles, setProgress, add, fail, drop };
}
