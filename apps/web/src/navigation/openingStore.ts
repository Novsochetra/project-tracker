import { useEffect, useLayoutEffect, useState } from 'react';

// The path a push or replace is on its way to, until the location changes.
export interface OpeningStore {
  get: () => string | null;
  set: (path: string | null) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createOpeningStore(): OpeningStore {
  let path: string | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => path,
    set: (next) => {
      if (next === path) return;
      path = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

// Navigations are transitions (React Router's default), so a push to a screen whose code is still
// on its way leaves the location on screen as it was until the code arrives (PT-48). Compared
// with that location, a second tap on the same row pushed it again, and Back then had to be
// pressed twice (PT-94). Until the location changes, the path on its way is the one that counts.
export function useOpeningStore(locationKey: string): OpeningStore {
  const [store] = useState(createOpeningStore);
  useLayoutEffect(() => store.set(null), [store, locationKey]);
  // A Back while a push is on its way returns to the location on screen, whose key is unchanged.
  useEffect(() => {
    const clear = () => store.set(null);
    window.addEventListener('popstate', clear);
    return () => window.removeEventListener('popstate', clear);
  }, [store]);
  return store;
}
