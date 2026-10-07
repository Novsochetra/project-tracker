import { DURATION } from '../../design/motion';

export interface ToastMessage {
  id: number;
  text: string;
  leaving: boolean;
}

export interface ToastState {
  toast: ToastMessage | null;
  raised: number;
}

export interface ToastStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => ToastState;
  show: (text: string) => void;
  raise: () => () => void;
  dispose: () => void;
}

export const TOAST_VISIBLE_MS = DURATION.toast;
export const TOAST_EXIT_MS = DURATION.fast;

export function createToastStore(): ToastStore {
  let state: ToastState = { toast: null, raised: 0 };
  let nextId = 1;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();

  const update = (patch: Partial<ToastState>) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };
  const after = (ms: number, run: () => void) => {
    clearTimeout(timer);
    timer = setTimeout(run, ms);
  };

  const show = (text: string) => {
    update({ toast: { id: nextId++, text, leaving: false } });
    after(TOAST_VISIBLE_MS, () => {
      if (state.toast) update({ toast: { ...state.toast, leaving: true } });
      after(TOAST_EXIT_MS, () => update({ toast: null }));
    });
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
    raise,
    dispose: () => clearTimeout(timer),
  };
}
