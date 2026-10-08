import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

export const AUTOSAVE_DELAY_MS = 400;

export interface Autosave {
  schedule: (value: string) => void;
  flush: () => void;
  commit: (value: string) => void;
}

export function useAutosave(save: (value: string) => void, delayMs = AUTOSAVE_DELAY_MS): Autosave {
  const saveRef = useRef(save);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingRef = useRef<{ value: string } | null>(null);
  useLayoutEffect(() => {
    saveRef.current = save;
  });

  const flush = useCallback(() => {
    clearTimeout(timerRef.current);
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending) saveRef.current(pending.value);
  }, []);

  const schedule = useCallback(
    (value: string) => {
      pendingRef.current = { value };
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, delayMs);
    },
    [delayMs, flush],
  );

  const commit = useCallback(
    (value: string) => {
      pendingRef.current = { value };
      flush();
    },
    [flush],
  );

  useEffect(() => flush, [flush]);

  return { schedule, flush, commit };
}
