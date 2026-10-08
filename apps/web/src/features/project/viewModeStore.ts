import { useSyncExternalStore } from 'react';

export type ViewMode = 'list' | 'board';

export const DEFAULT_VIEW_MODE: ViewMode = 'list';

const STORAGE_PREFIX = 'tracker.projectView.';

// Used only when storage refuses a write (private mode, blocked site data, full quota), so the
// choice still lasts for the session.
const unsaved = new Map<string, ViewMode>();
const listeners = new Set<() => void>();

const storageKey = (projectKey: string): string => STORAGE_PREFIX + projectKey.toUpperCase();
const isViewMode = (value: unknown): value is ViewMode => value === 'list' || value === 'board';

function readStored(projectKey: string): ViewMode | null {
  try {
    const value = window.localStorage.getItem(storageKey(projectKey));
    return isViewMode(value) ? value : null;
  } catch {
    return null;
  }
}

function writeStored(projectKey: string, mode: ViewMode): boolean {
  try {
    window.localStorage.setItem(storageKey(projectKey), mode);
    return true;
  } catch {
    return false;
  }
}

export const getViewMode = (projectKey: string): ViewMode =>
  unsaved.get(storageKey(projectKey)) ?? readStored(projectKey) ?? DEFAULT_VIEW_MODE;

export function setViewMode(projectKey: string, mode: ViewMode): void {
  if (writeStored(projectKey, mode)) unsaved.delete(storageKey(projectKey));
  else unsaved.set(storageKey(projectKey), mode);
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useViewMode = (projectKey: string): ViewMode =>
  useSyncExternalStore(
    subscribe,
    () => getViewMode(projectKey),
    () => DEFAULT_VIEW_MODE,
  );
