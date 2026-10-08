import { BLACK, contrast, mix, parseHex, toHex, WHITE, type Rgb } from '../../lib/contrast';

const AA_TEXT = 4.5;
// VerdictChip.module.css draws the chip on a 10% tint of its color over the white surface.
const TINT = 0.1;
const SHADES = Array.from({ length: 21 }, (_, step) => 1 - step / 20);

// Checked as the browser paints them, in whole 8-bit steps.
const painted = (color: Rgb): Rgb => parseHex(toHex(color)) ?? color;

// A status color is data, so it can be too light for a label on its own tint (teal reads at
// 2.77:1). The label then takes the lightest shade of it toward black that reads at 4.5:1, which
// keeps the hue.
export function chipTextColor(color: string): string {
  const base = parseHex(color);
  if (!base) return color;
  const tint = painted(mix(base, WHITE, TINT));
  const shade = (amount: number) => painted(mix(base, BLACK, amount));
  const amount = SHADES.find((step) => contrast(shade(step), tint) >= AA_TEXT) ?? 0;
  return amount === 1 ? color : toHex(shade(amount));
}
