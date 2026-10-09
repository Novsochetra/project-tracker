import { useEffect, useLayoutEffect, useState } from 'react';

// The path a push or replace is on its way to, until the location changes.
export interface OpeningStore {
  get: () => string | null;
  // The result says whether this push is still the one on its way when its screen's code arrives:
  // a later push, a Back or a location change takes its place.
  open: (path: string) => () => boolean;
  clear: () => void;
  subscribe: (listener: () => void) => () => void;
}

export function createOpeningStore(): OpeningStore {
  let current: { path: string } | null = null;
  const listeners = new Set<() => void>();
  const change = (next: { path: string } | null) => {
    const changed = next?.path !== current?.path;
    current = next;
    if (changed) listeners.forEach((listener) => listener());
  };
  return {
    get: () => current?.path ?? null,
    open: (path) => {
      const entry = { path };
      change(entry);
      return () => current === entry;
    },
    clear: () => change(null),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

// A push to a screen whose code is still on its way waits for it before it touches the history
// (PT-100), and the row that pushed stays pressed meanwhile (PT-94). Until the location changes,
// the path on its way is the one a second tap compares with, so it doesn't push again.
export function useOpeningStore(locationKey: string): OpeningStore {
  const [store] = useState(createOpeningStore);
  useLayoutEffect(() => store.clear(), [store, locationKey]);
  // The browser's Back while a push waits leaves the screen on show, which forgets the push.
  useEffect(() => {
    const clear = () => store.clear();
    window.addEventListener('popstate', clear);
    return () => window.removeEventListener('popstate', clear);
  }, [store]);
  return store;
}
