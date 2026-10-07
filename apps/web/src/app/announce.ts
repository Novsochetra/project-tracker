import { useSyncExternalStore } from 'react';

let message = '';
const listeners = new Set<() => void>();

export function announce(text: string): void {
  message = text;
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useAnnouncement = (): string =>
  useSyncExternalStore(
    subscribe,
    () => message,
    () => '',
  );
