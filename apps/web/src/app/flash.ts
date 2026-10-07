import { useSyncExternalStore } from 'react';

const FLASH_MS = 1600;
let flashing: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

const emit = () => listeners.forEach((listener) => listener());

export function flashRows(ids: readonly string[]): void {
  flashing = new Set(ids);
  emit();
  clearTimeout(timer);
  timer = setTimeout(() => {
    flashing = new Set();
    emit();
  }, FLASH_MS);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useIsFlashing(id: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => flashing.has(id),
    () => false,
  );
}
