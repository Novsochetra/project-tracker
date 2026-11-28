// sRGB channels from 0 to 1 as encoded, not linear: CSS mixes colors that way.
export type Rgb = [number, number, number];

export const WHITE: Rgb = [1, 1, 1];
export const BLACK: Rgb = [0, 0, 0];

export function parseHex(hex: string): Rgb | null {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
  if (!match) return null;

  return match.slice(1).map((part) => Number.parseInt(part, 16) / 255) as Rgb;
}

const toByte = (channel: number): string =>
  Math.round(Math.min(1, Math.max(0, channel)) * 255)
    .toString(16)
    .padStart(2, '0');

export const toHex = (color: Rgb): string => `#${color.map(toByte).join('')}`;

const linear = (channel: number): number =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

export function luminance([red, green, blue]: Rgb): number {
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

export function contrast(first: Rgb, second: Rgb): number {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((x, y) => y - x) as [
    number,
    number,
  ];

  return (lighter + 0.05) / (darker + 0.05);
}

export const mix = (color: Rgb, base: Rgb, amount: number): Rgb =>
  color.map((channel, index) => channel * amount + base[index]! * (1 - amount)) as Rgb;

const STEPS = Array.from({ length: 21 }, (_, step) => 1 - step / 20);

// Checked as the browser paints them, in whole 8-bit steps.
const painted = (color: Rgb): Rgb => parseHex(toHex(color)) ?? color;

// A color is data, so it may not read where it is drawn. This keeps it when it reaches `minimum`
// against `background`, else takes the nearest 5% step of it toward `toward` that does, which
// keeps its hue.
export function nearestReadable(
  color: string,
  toward: Rgb,
  background: Rgb,
  minimum: number,
): string {
  const base = parseHex(color);
  if (!base) return color;

  const step = (amount: number) => painted(mix(base, toward, amount));
  const amount = STEPS.find((each) => contrast(step(each), painted(background)) >= minimum) ?? 0;

  return amount === 1 ? color : toHex(step(amount));
}
