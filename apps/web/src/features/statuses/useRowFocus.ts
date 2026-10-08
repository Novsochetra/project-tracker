import { useRef } from 'react';

const FOCUS = { preventScroll: true } as const;

// A status just created has no row until the list refreshes, so focus waits for its row to mount.
export function useRowFocus() {
  const rows = useRef(new Map<string, HTMLButtonElement>());
  const waitingFor = useRef<string | null>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const rowRef = (id: string) => (element: HTMLButtonElement | null) => {
    if (!element) {
      rows.current.delete(id);
      return;
    }
    rows.current.set(id, element);
    if (waitingFor.current !== id) return;
    waitingFor.current = null;
    element.focus(FOCUS);
  };
  const focusRow = (id?: string) => {
    const row = id ? rows.current.get(id) : undefined;
    waitingFor.current = row ? null : (id ?? null);
    (row ?? addRef.current)?.focus(FOCUS);
  };
  return { addRef, rowRef, focusRow };
}
