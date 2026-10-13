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

// A tap sends its pointer events first and its mouse events after them; the mousedown is what takes
// focus out of the field, so the mouse events count as the press too.
const PRESS_EVENTS = [
  ['pointerdown', press],
  ['pointerup', release],
  ['pointercancel', release],
  ['mousedown', press],
  ['mouseup', release],
] as const;

function listen(): () => void {
  PRESS_EVENTS.forEach(([type, handler]) => document.addEventListener(type, handler, true));
  document.addEventListener('focusin', notify);
  document.addEventListener('focusout', leave);
  return () => {
    PRESS_EVENTS.forEach(([type, handler]) => document.removeEventListener(type, handler, true));
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

// On touch devices the on-screen keyboard is up while a text field has focus.
export const useEditingText = (): boolean => useSyncExternalStore(subscribe, snapshot, () => false);

export const lastEditedField = (): HTMLElement | null => lastField;
