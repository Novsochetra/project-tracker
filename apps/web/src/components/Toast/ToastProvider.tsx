import clsx from 'clsx';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ToastContext } from './context';
import styles from './Toast.module.css';
import { ToastCard } from './ToastCard';
import { createToastStore, type ToastMessage, type ToastStore } from './toastStore';
import { isUndoShortcut } from './undoShortcut';

export function ToastProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createToastStore);
  useEffect(() => () => store.dispose(), [store]);
  return (
    <ToastContext.Provider value={store}>
      {children}
      <ToastViewport store={store} />
    </ToastContext.Provider>
  );
}

// The toast sits after everything else on the page, too far to Tab to in time, so ⌘Z reaches
// its Undo from wherever the keyboard is.
function useUndoShortcut(store: ToastStore, toast: ToastMessage | null): void {
  const id = toast?.undo ? toast.id : null;
  useEffect(() => {
    if (id === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isUndoShortcut(event, document.activeElement)) return;
      event.preventDefault();
      store.undo(id);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [store, id]);
}

function ToastViewport({ store }: { store: ToastStore }) {
  const { toast, raised, shielded } = useSyncExternalStore(store.subscribe, store.getSnapshot);
  useUndoShortcut(store, toast);
  return (
    <div
      role="status"
      className={clsx(styles.region, raised > 0 && styles.raised, shielded && styles.shielded)}
    >
      {toast && <ToastCard key={toast.id} toast={toast} store={store} />}
    </div>
  );
}
