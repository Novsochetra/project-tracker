import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DESKTOP_QUERY, PHONE_QUERY } from '../../src/lib/media';

// PT-84, from PT-73's review: an iPhone turned sideways (844×390) is wider than 768px, so it got
// the desktop layout with the 240px sidebar, about 604px left for the ticket on a 390px-tall
// screen. The phone layout is now chosen by width, or by a touch screen under 500px tall, and the
// CSS must say the same as the code, or a turned phone would mix the two layouts.

interface Device {
  width: number;
  height: number;
  pointer: 'coarse' | 'fine' | 'none';
}

const RANGE = /^\((min|max)-(width|height): (\d+)px\)$/;
const POINTER = /^\(pointer: (coarse|fine|none)\)$/;

// Enough of media queries for the two the app uses: lists of features joined by `and`.
function holds(feature: string, device: Device): boolean {
  const range = RANGE.exec(feature);
  if (range) {
    const [, bound, side, value] = range;
    const size = device[side as 'width' | 'height'];
    return bound === 'min' ? size >= Number(value) : size <= Number(value);
  }
  const pointer = POINTER.exec(feature);
  if (pointer) return device.pointer === pointer[1];
  throw new Error(`Unknown media feature: ${feature}`);
}

const matches = (query: string, device: Device): boolean =>
  query
    .split(',')
    .some((part) => part.split(' and ').every((feature) => holds(feature.trim(), device)));

const layoutOf = (device: Device): string => {
  const phone = matches(PHONE_QUERY, device);
  const desktop = matches(DESKTOP_QUERY, device);
  if (phone === desktop) return `both or neither (phone ${phone}, desktop ${desktop})`;
  return phone ? 'phone' : 'desktop';
};

const devices: Array<[string, Device, 'phone' | 'desktop']> = [
  ['iPhone 13 upright', { width: 390, height: 844, pointer: 'coarse' }, 'phone'],
  ['iPhone 13 sideways', { width: 844, height: 390, pointer: 'coarse' }, 'phone'],
  ['iPhone Pro Max sideways', { width: 932, height: 430, pointer: 'coarse' }, 'phone'],
  ['Android phone sideways', { width: 915, height: 412, pointer: 'coarse' }, 'phone'],
  ['iPhone SE sideways', { width: 568, height: 320, pointer: 'coarse' }, 'phone'],
  [
    'iPad mini upright (under 768px, as before)',
    { width: 744, height: 1133, pointer: 'coarse' },
    'phone',
  ],
  ['iPad mini sideways', { width: 1133, height: 744, pointer: 'coarse' }, 'desktop'],
  ['iPad upright', { width: 768, height: 1024, pointer: 'coarse' }, 'desktop'],
  ['iPad Air sideways', { width: 1180, height: 820, pointer: 'coarse' }, 'desktop'],
  ['Android tablet sideways', { width: 960, height: 600, pointer: 'coarse' }, 'desktop'],
  ['desktop', { width: 1280, height: 800, pointer: 'fine' }, 'desktop'],
  ['short desktop window', { width: 1024, height: 420, pointer: 'fine' }, 'desktop'],
  ['narrow desktop window', { width: 600, height: 800, pointer: 'fine' }, 'phone'],
  ['short screen with no pointer', { width: 1024, height: 420, pointer: 'none' }, 'desktop'],
];

describe('regression: a phone turned sideways keeps the phone layout', () => {
  it.each(devices)('%s', (_name, device, layout) => {
    expect(layoutOf(device)).toBe(layout);
  });
});

const SRC = join(import.meta.dirname, '../../src');
const BREAKPOINT = /76[78]px/;

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return cssFiles(path);
    return entry.name.endsWith('.css') ? [path] : [];
  });
}

function mediaQueries(path: string): string[] {
  const css = readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  return [...css.matchAll(/@media([^{]+)\{/g)].map((match) =>
    match[1]!.replace(/\s+/g, ' ').trim(),
  );
}

it('uses the same phone and desktop queries in every stylesheet as in the code', () => {
  const strays = cssFiles(SRC).flatMap((path) =>
    mediaQueries(path)
      .filter((query) => BREAKPOINT.test(query))
      .filter((query) => query !== PHONE_QUERY && query !== DESKTOP_QUERY)
      .map((query) => `${relative(SRC, path)}: ${query}`),
  );
  expect(strays).toEqual([]);
});
