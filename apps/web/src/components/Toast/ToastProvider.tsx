import clsx from 'clsx';
import { CircleCheck } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Icon } from '../Icon';
import { ToastContext } from './context';
import styles from './Toast.module.css';
import { createToastStore, type ToastStore } from './toastStore';

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

function ToastViewport({ store }: { store: ToastStore }) {
  const { toast, raised } = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return (
    <div role="status" className={clsx(styles.region, raised > 0 && styles.raised)}>
      {toast && (
        <div key={toast.id} className={clsx(styles.toast, toast.leaving && styles.leaving)}>
          <Icon icon={CircleCheck} />
          <span className={styles.text}>{toast.text}</span>
        </div>
      )}
    </div>
  );
}
