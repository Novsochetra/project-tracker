import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Appearance } from '../../src/appearance';
import { luminance, parseHex, type Rgb } from '../../src/lib/contrast';

export { contrast, luminance, mix, type Rgb } from '../../src/lib/contrast';

const TOKENS = join(import.meta.dirname, '../../src/design/tokens.css');
const BLOCKS: Record<Appearance, RegExp> = {
  light: /:root\s*{([^}]*)}/,
  dark: /:root\[data-appearance='dark'\]\s*{([^}]*)}/,
};

export const APPEARANCES: readonly Appearance[] = ['light', 'dark'];

function declarations(css: string, block: RegExp): [string, string][] {
  const body = block.exec(css)?.[1] ?? '';

  return [...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((match) => [
    match[1]!,
    match[2]!.trim(),
  ]);
}

// The light set is the first :root block; the dark set overrides it while the page is dark.
function readTokens(): Record<Appearance, Map<string, string>> {
  const css = readFileSync(TOKENS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const light = new Map(declarations(css, BLOCKS.light));
  const dark = new Map([...light, ...declarations(css, BLOCKS.dark)]);

  return { light, dark };
}

const tokens = readTokens();

// A token as the page computes it: one written as var(--other) takes the other's value.
export function tokenValue(token: string, appearance: Appearance = 'light'): string {
  const value = tokens[appearance].get(token) ?? `${token} (missing)`;
  const reference = /^var\((--[\w-]+)\)$/.exec(value);

  return reference ? tokenValue(reference[1]!, appearance) : value;
}

export function rgb(hex: string): Rgb {
  const color = parseHex(hex);
  if (!color) throw new Error(`"${hex}" is not a #rrggbb color`);

  return color;
}

export const color = (token: string, appearance: Appearance = 'light'): Rgb =>
  rgb(tokenValue(token, appearance));

// CIELAB L*: unlike luminance, equal steps of it look equally far apart.
export function lightness(color: Rgb): number {
  const y = luminance(color);

  return y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (24389 / 27) * y;
}

const BLENDS: Record<string, (row: number, flash: number) => number> = {
  multiply: (row, flash) => row * flash,
  lighten: (row, flash) => Math.max(row, flash),
};

// The row flash is drawn over a row with --flash-blend: multiply in the light appearance (it
// darkens toward the tint), lighten in the dark one (it brightens what is darker than the tint).
export function blendFlash(under: Rgb, appearance: Appearance): Rgb {
  const flash = color('--flash', appearance);
  const blend = BLENDS[tokenValue('--flash-blend', appearance)]!;

  return under.map((channel, index) => blend(channel, flash[index]!)) as Rgb;
}
