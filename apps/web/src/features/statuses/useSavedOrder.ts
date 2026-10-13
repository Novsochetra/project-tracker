import { useRef, useState } from 'react';
import { sameMembers, sameOrder } from './statusForm';

export interface SavedOrder {
  ids: string[];
  preview: (ids: string[]) => void;
  commitPreview: () => void;
  commit: (ids: string[]) => void;
  error: Error | null;
}

export interface OrderSave {
  mutate: (ids: string[], onSettled: () => void) => void;
  error: Error | null;
}

// Holds the dragged order until the save settles; the optimistic cache update is async, so
// dropping the local order at once would flash the old order for a frame.
export function useSavedOrder(serverIds: string[], save: OrderSave): SavedOrder {
  const [local, setLocal] = useState<string[] | null>(null);
  const dragged = useRef<string[] | null>(null);
  const ids = local && sameMembers(local, serverIds) ? local : serverIds;

  const commit = (next: string[]) => {
    if (sameOrder(next, serverIds)) {
      setLocal(null);
      return;
    }
    setLocal(next);
    save.mutate(next, () => setLocal(null));
  };
  const preview = (next: string[]) => {
    dragged.current = next;
    setLocal(next);
  };
  // Reads the ref, not render state: the drop can reorder once more right before it ends.
  const commitPreview = () => {
    const next = dragged.current;
    dragged.current = null;
    if (next) commit(next);
  };
  return { ids, preview, commitPreview, commit, error: save.error };
}
