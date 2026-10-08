import { useEffect, type RefObject } from 'react';
import { useToast } from '../../components';
import { noticeTitle, type FileNotice } from './fileNotice';
import { inSight } from './inSight';

// An upload fails late, wherever the person is by then. Its tile stays and says so, but the note
// that says why lands below the files, out of sight from the middle of many files at 320×568, or
// from the Add tile at the bottom of the screen, and on the ticket screen the tile can be out of
// sight too (PT-95). So then a toast says it, over whatever is on screen, and moves nothing.
export function useToastIfUnseen(note: RefObject<HTMLElement | null>, notice: FileNotice | null) {
  const toast = useToast();
  useEffect(() => {
    if (notice && note.current && !inSight(note.current)) {
      toast.show(noticeTitle(notice), { kind: 'error' });
    }
  }, [note, notice, toast]);
}
