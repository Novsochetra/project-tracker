import type { Appearance } from '../../appearance/resolveAppearance';
import { DARK_CHIP_SURFACE } from '../../appearance/darkColors';
import { BLACK, mix, nearestReadable, parseHex, WHITE } from '../../lib/contrast';

const AA_TEXT = 4.5;
// VerdictChip.module.css draws the chip on a 10% tint of its color over the surface.
const TINT = 0.1;

// A status color is data, so it can be too light for a label on its own tint (teal reads at
// 2.77:1), or too dark on a dark surface: checked over the lightest one a chip sits on, it reads
// on all of them. The label then takes the nearest shade of it toward
// black, or tint toward white in the dark appearance, that reads at 4.5:1, which keeps the hue.
export function chipTextColor(color: string, appearance: Appearance = 'light'): string {
  const base = parseHex(color);
  if (!base) return color;

  const dark = appearance === 'dark';
  const tint = mix(base, dark ? parseHex(DARK_CHIP_SURFACE)! : WHITE, TINT);

  return nearestReadable(color, dark ? WHITE : BLACK, tint, AA_TEXT);
}
