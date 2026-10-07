import type { ChangeEvent } from '@tracker/shared';

export type ChangeListener = (event: ChangeEvent) => void;

export interface Broadcaster {
  publish(event: ChangeEvent): void;
  subscribe(listener: ChangeListener): () => void;
  listenerCount(): number;
}

export function createBroadcaster(): Broadcaster {
  const listeners = new Set<ChangeListener>();
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
