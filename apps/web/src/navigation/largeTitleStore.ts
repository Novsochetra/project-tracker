export interface LargeTitleSnapshot {
  present: boolean;
  visible: boolean;
}

export interface LargeTitleStore {
  get: () => LargeTitleSnapshot;
  set: (next: LargeTitleSnapshot) => void;
  subscribe: (listener: () => void) => () => void;
}

export const NO_LARGE_TITLE: LargeTitleSnapshot = { present: false, visible: false };

export function createLargeTitleStore(): LargeTitleStore {
  let snapshot = NO_LARGE_TITLE;
  const listeners = new Set<() => void>();
  return {
    get: () => snapshot,
    set: (next) => {
      if (next.present === snapshot.present && next.visible === snapshot.visible) return;
      snapshot = next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
