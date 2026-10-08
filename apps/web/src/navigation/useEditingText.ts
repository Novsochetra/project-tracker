import { useSyncExternalStore } from 'react';
import { isEditable } from '../lib/editable';
import { isTouchDevice } from '../lib/platform';

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
