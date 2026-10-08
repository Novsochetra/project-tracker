import { DURATION } from '../../design/motion';

export type ToastKind = 'success' | 'error';

export interface ToastOptions {
  kind?: ToastKind;
  /** Offers Undo, which runs this once; the toast stays up longer to give time for it. */
  undo?: () => void;
}

export interface ToastMessage {
  id: number;
  text: string;
  kind: ToastKind;
  undo: (() => void) | null;
  leaving: boolean;
}

export interface ToastState {
  toast: ToastMessage | null;
  raised: number;
  shielded: boolean;
}

export interface ToastStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => ToastState;
  show: (text: string, options?: ToastOptions) => void;
  /** Runs the undo of the toast with this id, once, while that toast shows. */
  undo: (id: number) => void;
  /** Keeps the toast with this id up while it is hovered or has focus. */
  hold: (id: number, held: boolean) => void;
  raise: () => () => void;
  dispose: () => void;
}

export const TOAST_VISIBLE_MS = DURATION.toast;
export const TOAST_UNDO_MS = DURATION.toastUndo;
export const TOAST_EXIT_MS = DURATION.fast;
// Longer than a double tap, whose second tap lands within about 300 ms of the first.
export const TOAST_SHIELD_MS = 500;

const visibleMs = (toast: ToastMessage): number => (toast.undo ? TOAST_UNDO_MS : TOAST_VISIBLE_MS);

export function createToastStore(): ToastStore {
  let state: ToastState = { toast: null, raised: 0, shielded: false };
  let nextId = 1;
  let held = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let shieldTimer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();

  const update = (patch: Partial<ToastState>) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };
  const after = (ms: number, run: () => void) => {
    clearTimeout(timer);
    timer = setTimeout(run, ms);
  };
  const current = (id: number) => (state.toast?.id === id ? state.toast : null);
  const showing = (id: number) => (current(id)?.leaving ? null : current(id));

  const leave = () => {
    if (state.toast) update({ toast: { ...state.toast, leaving: true } });
    after(TOAST_EXIT_MS, () => update({ toast: null }));
  };

  const show = (text: string, { kind = 'success', undo }: ToastOptions = {}) => {
    const toast = { id: nextId++, text, kind, undo: undo ?? null, leaving: false };
    held = false;
    update({ toast });
    after(visibleMs(toast), leave);
  };

  const hold = (id: number, next: boolean) => {
    const toast = showing(id);
    if (!toast || next === held) return;
    held = next;
    if (held) clearTimeout(timer);
    else after(visibleMs(toast), leave);
  };

  // Undo changes or removes the toast under the finger, so the second tap of a double tap would
  // land on whatever lies below it.
  const shield = () => {
    clearTimeout(shieldTimer);
    update({ shielded: true });
    shieldTimer = setTimeout(() => update({ shielded: false }), TOAST_SHIELD_MS);
  };

  // Also while the toast fades out: Undo is still there to be pressed.
  const undo = (id: number) => {
    const toast = current(id);
    if (!toast?.undo) return;
    update({ toast: { ...toast, undo: null } });
    shield();
    toast.undo();
    if (state.toast?.id === id) leave();
  };

  const raise = () => {
    let active = true;
    update({ raised: state.raised + 1 });
    return () => {
      if (!active) return;
      active = false;
      update({ raised: state.raised - 1 });
    };
  };

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => state,
    show,
    undo,
    hold,
    raise,
    dispose: () => {
      clearTimeout(timer);
      clearTimeout(shieldTimer);
    },
  };
}
