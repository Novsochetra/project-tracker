import type { ChangeNotice } from './changeNotice';

export type Listener<T> = (event: T) => void;

export interface Broadcaster<T = ChangeNotice> {
  publish(event: T): void;
  subscribe(listener: Listener<T>): () => void;
  listenerCount(): number;
}

export function createBroadcaster<T = ChangeNotice>(): Broadcaster<T> {
  const listeners = new Set<Listener<T>>();
  return {
    publish(event) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (error) {
          console.error('Change listener failed', error);
        }
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    listenerCount: () => listeners.size,
  };
}
