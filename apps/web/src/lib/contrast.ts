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

export function contrast(a: Rgb, b: Rgb): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (lighter + 0.05) / (darker + 0.05);
}

export const mix = (color: Rgb, base: Rgb, amount: number): Rgb =>
  color.map((channel, index) => channel * amount + base[index]! * (1 - amount)) as Rgb;
