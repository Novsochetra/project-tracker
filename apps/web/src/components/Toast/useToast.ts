import { useContext, useEffect, useSyncExternalStore } from 'react';
import { ToastContext } from './context';
import type { ToastStore } from './toastStore';

export type ToastApi = Pick<ToastStore, 'show'>;

export function useToast(): ToastApi {
  const store = useContext(ToastContext);
  if (!store) throw new Error('useToast needs a ToastProvider');
  return store;
}

export function useToastRaise(active: boolean): void {
  const store = useContext(ToastContext);
  useEffect(() => {
    if (!active || !store) return;
    return store.raise();
  }, [active, store]);
}

const noSubscription = () => () => undefined;

// Something that sits where a toast shows (above the phone's bottom bar) makes way for it.
export function useToastShowing(): boolean {
  const store = useContext(ToastContext);
  return useSyncExternalStore(
    store?.subscribe ?? noSubscription,
    () => Boolean(store?.getSnapshot().toast),
    () => false,
  );
}
