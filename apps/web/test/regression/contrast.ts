import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { luminance, parseHex, type Rgb } from '../../src/lib/contrast';

export { contrast, luminance, mix, type Rgb } from '../../src/lib/contrast';

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
  const color = parseHex(hex);
  if (!color) throw new Error(`"${hex}" is not a #rrggbb color`);
  return color;
}

export const color = (token: string): Rgb => rgb(tokens.get(token) ?? `${token} (missing)`);

// CIELAB L*: unlike luminance, equal steps of it look equally far apart.
export function lightness(color: Rgb): number {
  const y = luminance(color);
  return y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (24389 / 27) * y;
}
