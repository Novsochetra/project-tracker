import { useSyncExternalStore } from 'react';

export interface Announcement {
  id: number;
  text: string;
}

// Long enough for a screen reader to reach a queued polite message, short enough that nobody
// browsing the page later finds an old one.
export const ANNOUNCEMENT_CLEAR_MS = 7_000;

const SILENCE: Announcement = { id: 0, text: '' };
let current = SILENCE;
let nextId = 1;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function publish(next: Announcement): void {
  current = next;
  listeners.forEach((listener) => listener());
}

// Every call gets a new id, so the region renders a new node and repeated words are read again.
export function announce(text: string): void {
  clearTimeout(timer);
  publish(text ? { id: nextId++, text } : SILENCE);
  if (text) timer = setTimeout(() => publish(SILENCE), ANNOUNCEMENT_CLEAR_MS);
}

export function clearAnnouncement(text: string): void {
  if (current.text === text) announce('');
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useAnnouncement = (): Announcement =>
  useSyncExternalStore(
    subscribe,
    () => current,
    () => SILENCE,
  );
