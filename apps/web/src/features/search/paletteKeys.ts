export type PaletteAction = 'next' | 'previous' | 'open';

type ListKey = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'isComposing'>;

// Control-N and Control-P move too on Apple platforms, as in the macOS text system; elsewhere
// Chrome keeps Control-N for a new window.
export function paletteAction(event: ListKey, apple: boolean): PaletteAction | null {
  if (event.isComposing || event.altKey) return null;
  const control = apple && event.ctrlKey && !event.metaKey;
  if (event.key === 'ArrowDown' || (control && event.key === 'n')) return 'next';
  if (event.key === 'ArrowUp' || (control && event.key === 'p')) return 'previous';

  return event.key === 'Enter' ? 'open' : null;
}

export function stepIndex(index: number, count: number, step: 1 | -1): number {
  if (count === 0) return -1;
  if (index < 0) return step === 1 ? 0 : count - 1;

  return (index + step + count) % count;
}
