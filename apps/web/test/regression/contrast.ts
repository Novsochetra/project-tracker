import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type Rgb = [number, number, number];

const TOKENS = join(import.meta.dirname, '../../src/design/tokens.css');

function readTokens(): Map<string, string> {
  const css = readFileSync(TOKENS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const root = /:root\s*{([^}]*)}/.exec(css)?.[1] ?? '';
  return new Map(
    [...root.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((match) => [match[1]!, match[2]!.trim()]),
  );
}

const tokens = readTokens();

export function rgb(hex: string): Rgb {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`"${hex}" is not a #rrggbb color`);
  return [match[1]!, match[2]!, match[3]!].map((part) => Number.parseInt(part, 16) / 255) as Rgb;
}

/** A color token from tokens.css, such as `--muted`. */
export const color = (token: string): Rgb => rgb(tokens.get(token) ?? `${token} (missing)`);

const linear = (channel: number): number =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

export function luminance(color: Rgb): number {
  const [r, g, b] = color.map(linear) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The WCAG 2 contrast ratio, 1 to 21. */
export function contrast(a: Rgb, b: Rgb): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (lighter + 0.05) / (darker + 0.05);
}

// Like color-mix(in srgb, …): channels mix as encoded, before linearizing.
export const mix = (color: Rgb, base: Rgb, amount: number): Rgb =>
  color.map((channel, index) => channel * amount + base[index]! * (1 - amount)) as Rgb;

/** CIELAB L*: how light a color looks, from 0 (black) to 100 (white). */
export function lightness(color: Rgb): number {
  const y = luminance(color);
  return y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (24389 / 27) * y;
}
