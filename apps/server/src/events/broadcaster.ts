import type { ChangeEvent } from '@tracker/shared';

export type Listener<T> = (event: T) => void;

export interface Broadcaster<T = ChangeEvent> {
  publish(event: T): void;
  subscribe(listener: Listener<T>): () => void;
  listenerCount(): number;
}

export function createBroadcaster<T = ChangeEvent>(): Broadcaster<T> {
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
