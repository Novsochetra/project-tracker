import { useSyncExternalStore } from 'react';
import { parseQueue, waitingCount, type CaptureQueue } from './captureQueue';

export const QUEUE_STORAGE_KEY = 'tracker.capture.queue';

export interface QueueAccess {
  read: () => CaptureQueue;
  // A change rather than a new queue: it applies to what storage holds now, so other tabs' changes
  // since the last read are kept.
  update: (change: (queue: CaptureQueue) => CaptureQueue) => boolean;
}

const listeners = new Set<() => void>();
let cached: { raw: string | null; queue: CaptureQueue } = { raw: null, queue: parseQueue(null) };

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(QUEUE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function readQueue(): CaptureQueue {
  const raw = readRaw();
  if (raw !== cached.raw) cached = { raw, queue: parseQueue(raw) };
  return cached.queue;
}

export function updateQueue(change: (queue: CaptureQueue) => CaptureQueue): boolean {
  const current = readQueue();
  const next = change(current);
  if (next === current) return true;
  try {
    window.localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    return false;
  }
  listeners.forEach((listener) => listener());
  return true;
}

export const queueStore: QueueAccess = { read: readQueue, update: updateQueue };

// The storage event only reports other tabs' changes; this tab's own come through the listeners.
export function subscribeQueue(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === QUEUE_STORAGE_KEY || event.key === null) listener();
  };
  listeners.add(listener);
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export const useWaitingCount = (): number =>
  useSyncExternalStore(
    subscribeQueue,
    () => waitingCount(readQueue()),
    () => 0,
  );
