import { useRef, useState, type ClipboardEvent, type DragEvent } from 'react';
import { carriesFiles, filesOf } from './attachmentFiles';

export interface FileDropHandlers {
  onDragEnter: (event: DragEvent<HTMLElement>) => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDragLeave: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
}

export interface FileDrop {
  active: boolean;
  handlers: FileDropHandlers;
}

export function useFileDrop(onFiles: (files: File[]) => void): FileDrop {
  const [active, setActive] = useState(false);
  // Entering a child fires dragenter before the parent's dragleave, so count the nesting.
  const depthRef = useRef(0);
  const handlers: FileDropHandlers = {
    onDragEnter: (event) => {
      if (!carriesFiles(event.dataTransfer)) return;
      event.preventDefault();
      depthRef.current += 1;
      setActive(true);
    },
    onDragOver: (event) => {
      if (!carriesFiles(event.dataTransfer)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    },
    onDragLeave: (event) => {
      if (!carriesFiles(event.dataTransfer)) return;
      depthRef.current = Math.max(0, depthRef.current - 1);
      if (depthRef.current === 0) setActive(false);
    },
    onDrop: (event) => {
      if (!carriesFiles(event.dataTransfer)) return;
      event.preventDefault();
      depthRef.current = 0;
      setActive(false);
      const files = filesOf(event.dataTransfer);
      if (files.length > 0) onFiles(files);
    },
  };
  return { active, handlers };
}

export function pasteFiles(event: ClipboardEvent<HTMLElement>, onFiles: (files: File[]) => void) {
  const files = filesOf(event.clipboardData);
  if (files.length === 0) return;
  // Copying a file in Finder also puts its name on the clipboard; only the file is wanted.
  event.preventDefault();
  onFiles(files);
}
