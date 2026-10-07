import { useSyncExternalStore } from 'react';
import { isTouchDevice } from '../lib/platform';

const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number']);

function isEditable(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  if (element instanceof HTMLTextAreaElement) return !element.readOnly;
  if (element instanceof HTMLInputElement)
    return TEXT_INPUT_TYPES.has(element.type) && !element.readOnly;
  return element.isContentEditable;
}

function subscribe(onChange: () => void): () => void {
  document.addEventListener('focusin', onChange);
  document.addEventListener('focusout', onChange);
  return () => {
    document.removeEventListener('focusin', onChange);
    document.removeEventListener('focusout', onChange);
  };
}

const snapshot = (): boolean => isTouchDevice() && isEditable(document.activeElement);

/** On touch devices the on-screen keyboard is up while a text field has focus. */
export const useEditingText = (): boolean => useSyncExternalStore(subscribe, snapshot, () => false);
