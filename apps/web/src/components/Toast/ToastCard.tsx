import clsx from 'clsx';
import { CircleAlert, CircleCheck } from 'lucide-react';
import { useRef, type FocusEvent, type MouseEvent } from 'react';
import { styleNow } from '../../lib/styleNow';
import { Icon } from '../Icon';
import styles from './Toast.module.css';
import type { ToastMessage, ToastStore } from './toastStore';
import { UNDO_KEYS } from './undoShortcut';

const leavesToast = (event: FocusEvent<HTMLElement>): boolean =>
  !event.currentTarget.contains(event.relatedTarget);

// A toast with Undo stays while the pointer is on it or it has focus, so it can't vanish from
// under a hand or a keyboard about to use it; focus then goes back to where it came from.
function useToastHold(store: ToastStore, id: number) {
  const holders = useRef({ hovered: false, focused: false });
  const cameFrom = useRef<HTMLElement | null>(null);
  const set = (change: Partial<typeof holders.current>) => {
    Object.assign(holders.current, change);
    store.hold(id, holders.current.hovered || holders.current.focused);
  };
  return {
    handlers: {
      onPointerEnter: () => set({ hovered: true }),
      onPointerLeave: () => set({ hovered: false }),
      onFocus: (event: FocusEvent<HTMLElement>) => {
        if (leavesToast(event)) {
          const from = event.relatedTarget;
          cameFrom.current = from instanceof HTMLElement ? from : null;
        }
        set({ focused: true });
      },
      onBlur: (event: FocusEvent<HTMLElement>) => {
        if (leavesToast(event)) set({ focused: false });
      },
    },
    returnFocus: () => {
      if (cameFrom.current?.isConnected) cameFrom.current.focus({ preventScroll: true });
    },
  };
}

export function ToastCard({ toast, store }: { toast: ToastMessage; store: ToastStore }) {
  const hold = useToastHold(store, toast.id);
  const failed = toast.kind === 'error';
  const undo = (event: MouseEvent<HTMLButtonElement>) => {
    // The button goes once it has done its job; keyboard users keep their place.
    if (event.currentTarget === document.activeElement) hold.returnFocus();
    store.undo(toast.id);
  };
  // A toast can show on its own while a part's stylesheet loads, as after reconnecting.
  return (
    <div
      ref={styleNow}
      className={clsx(
        styles.toast,
        toast.undo && styles.withAction,
        toast.leaving && styles.leaving,
      )}
      {...(toast.undo ? hold.handlers : {})}
    >
      <Icon
        icon={failed ? CircleAlert : CircleCheck}
        className={clsx(styles.icon, failed && styles.errorIcon)}
      />
      <span className={styles.text}>{toast.text}</span>
      {toast.undo && (
        <button type="button" className={styles.undo} aria-keyshortcuts={UNDO_KEYS} onClick={undo}>
          Undo
        </button>
      )}
    </div>
  );
}
