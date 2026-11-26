export type PaletteKey = Pick<
  KeyboardEvent,
  'key' | 'code' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey' | 'repeat' | 'isComposing'
>;

// A Cyrillic or Greek layout sends its own letter for K, so the key's place counts there; a Latin
// layout such as Dvorak puts K elsewhere, so there the letter counts.
const isK = ({ key, code }: Pick<PaletteKey, 'key' | 'code'>): boolean =>
  key.toLowerCase() === 'k' || (!/^[a-z]$/i.test(key) && code === 'KeyK');

// Command on Apple keyboards, Control elsewhere: Control-K on a Mac stays the text fields'
// delete-to-end-of-line.
export function isPaletteShortcut(event: PaletteKey, apple: boolean): boolean {
  if (event.repeat || event.isComposing || event.altKey || event.shiftKey) return false;
  const modifier = apple ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;

  return modifier && isK(event);
}

export const shortcutHint = (apple: boolean): string => (apple ? '⌘K' : 'Ctrl K');

export function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return false;

  return /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
}
