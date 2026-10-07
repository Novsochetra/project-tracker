import { useEffect, useSyncExternalStore } from 'react';

const showing = new Set<symbol>();
const listeners = new Set<() => void>();

function setShowing(token: symbol, value: boolean): void {
  if (showing.has(token) === value) return;
  if (value) showing.add(token);
  else showing.delete(token);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const useBottomBarVisible = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => showing.size > 0,
    () => false,
  );

export function useRegisterBottomBar(visible: boolean): void {
  useEffect(() => {
    if (!visible) return;
    const token = Symbol('bottom-bar');
    setShowing(token, true);
    return () => setShowing(token, false);
  }, [visible]);
}
