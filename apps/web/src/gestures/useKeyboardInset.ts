import { useSyncExternalStore } from 'react';
import { isEditable } from '../lib/editable';

export interface KeyboardInset {
  inset: number;
  viewportHeight: number;
}

const FOCUS_EVENTS = ['focusin', 'focusout'] as const;
const VIEWPORT_EVENTS = ['resize', 'scroll'] as const;

function subscribe(onChange: () => void): () => void {
  const viewport = window.visualViewport;
  FOCUS_EVENTS.forEach((type) => document.addEventListener(type, onChange));
  VIEWPORT_EVENTS.forEach((type) => viewport?.addEventListener(type, onChange));
  return () => {
    FOCUS_EVENTS.forEach((type) => document.removeEventListener(type, onChange));
    VIEWPORT_EVENTS.forEach((type) => viewport?.removeEventListener(type, onChange));
  };
}

// iOS can keep reporting the visual viewport a keyboard shortened after the keyboard has gone
// (PT-205), and only a focused text field brings the keyboard up, so without one there is none.
function keyboardViewport(): VisualViewport | null {
  const viewport = window.visualViewport;
  if (!viewport || !isEditable(document.activeElement)) return null;
  // A pinch-zoomed page also shrinks the visual viewport; that is not a keyboard.
  return viewport.scale > 1.01 ? null : viewport;
}

function readInset(): number {
  const viewport = keyboardViewport();
  if (!viewport) return 0;
  return Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop));
}

const readHeight = (): number => Math.round(keyboardViewport()?.height ?? 0);

// iOS keeps the layout viewport behind the keyboard, so fixed sheets must lift themselves.
// A height of 0 means no keyboard: the sheet goes by the window.
export function useKeyboardInset(): KeyboardInset {
  const inset = useSyncExternalStore(subscribe, readInset, () => 0);
  const viewportHeight = useSyncExternalStore(subscribe, readHeight, () => 0);
  return { inset, viewportHeight };
}
