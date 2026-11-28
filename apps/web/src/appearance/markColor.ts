import { nearestReadable, parseHex, WHITE } from '../lib/contrast';
import { DARK_MARK_BACKGROUND } from './darkColors';
import type { Appearance } from './resolveAppearance';
import { useAppearance } from './useAppearance';

// WCAG 1.4.11: a status glyph or label dot carries meaning, so it keeps 3:1.
const AA_MARK = 3;

// Status and label colors are data, picked to read on white. In the dark appearance a dark one
// (Done's indigo, a deep red) takes the nearest tint of it toward white that keeps 3:1, as
// Apple's system colors have lighter dark variants.
export function markColor(color: string, appearance: Appearance): string {
  if (appearance === 'light') return color;

  return nearestReadable(color, WHITE, parseHex(DARK_MARK_BACKGROUND)!, AA_MARK);
}

export function useMarkColor(color: string): string;
export function useMarkColor(color: string | undefined): string | undefined;
export function useMarkColor(color: string | undefined): string | undefined {
  const appearance = useAppearance();

  return color === undefined ? undefined : markColor(color, appearance);
}
