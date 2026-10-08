import { useSyncExternalStore } from 'react';
import { isEditable } from '../lib/editable';
import { isTouchDevice } from '../lib/platform';

const listeners = new Set<() => void>();
let pressing = false;
// A press that takes focus out of a field, as the mousedown of a tap on Comment does, keeps the
// bar away until it ends: a bar coming back under the pointer would take the release, and the
// click with it.
let held = false;
let lastField: HTMLElement | null = null;

const notify = () => listeners.forEach((listener) => listener());

const press = () => {
  pressing = true;
};

function release(): void {
  pressing = false;
  if (!held) return;
  // The release's click comes later in the same task.
  setTimeout(() => {
    held = false;
    notify();
  });
}

function leave(event: FocusEvent): void {
  if (event.target instanceof HTMLElement && isEditable(event.target)) {
    lastField = event.target;
    held ||= pressing;
  }
  notify();
}

function listen(): () => void {
  document.addEventListener('pointerdown', press, true);
  document.addEventListener('pointerup', release, true);
  document.addEventListener('pointercancel', release, true);
  document.addEventListener('focusin', notify);
  document.addEventListener('focusout', leave);
  return () => {
    document.removeEventListener('pointerdown', press, true);
    document.removeEventListener('pointerup', release, true);
    document.removeEventListener('pointercancel', release, true);
    document.removeEventListener('focusin', notify);
    document.removeEventListener('focusout', leave);
    pressing = held = false;
  };
}

let stopListening: () => void = () => undefined;

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) stopListening = listen();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stopListening();
  };
}

const snapshot = (): boolean => isTouchDevice() && (held || isEditable(document.activeElement));

/** On touch devices the on-screen keyboard is up while a text field has focus. */
export const useEditingText = (): boolean => useSyncExternalStore(subscribe, snapshot, () => false);

/** The text field edited last, which the bottom bar keeps in sight when it comes back. */
export const lastEditedField = (): HTMLElement | null => lastField;
