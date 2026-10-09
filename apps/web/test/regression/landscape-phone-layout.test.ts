import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DESKTOP_QUERY, PHONE_QUERY, SIDEWAYS_QUERY } from '../../src/lib/media';

// PT-84, from PT-73's review: an iPhone turned sideways (844×390) is wider than 768px, so it got
// the desktop layout with the 240px sidebar, about 604px left for the ticket on a 390px-tall
// screen. Its review then found the first fix judged "short" by the window: Android Chrome
// shortens the window while the keyboard is open (interactive-widget=resizes-content), so a tablet
// held sideways (1280×712 under an 800px-tall screen) dropped to 1280×380 and switched to the phone
// layout mid-typing, unmounting the Details panel and the field being typed in. The phone layout
// now goes by the window's width or by the screen, which the keyboard doesn't change, and the CSS
// must say the same as the code, or one screen would mix the two layouts. The next review: phones
// set to a small display size reach 480px or more on their short side, so the line is Android's
// own tablet line, 600px; and with max-…: 500px against min-…: 501px a fractional size between
// matched neither query, so each boundary is written once, as `<` and `>=` of one number.

interface Device {
  width: number;
  height: number;
  // window.screen: iOS always reports it upright; Android turns it with the device.
  screen: [number, number];
  pointer: 'coarse' | 'fine' | 'none';
}

const RANGE = /^\((device-)?(width|height) (<|>=) (\d+)px\)$/;
const POINTER = /^\(pointer: (coarse|fine|none)\)$/;

function sizeOf(device: Device, screen: boolean, side: string): number {
  if (!screen) return side === 'width' ? device.width : device.height;
  return side === 'width' ? device.screen[0] : device.screen[1];
}

// Enough of media queries for the ones the app uses: lists of features joined by `and`.
function holds(feature: string, device: Device): boolean {
  const range = RANGE.exec(feature);
  if (range) {
    const [, screen, side, operator, value] = range;
    const size = sizeOf(device, screen !== undefined, side!);
    return operator === '<' ? size < Number(value) : size >= Number(value);
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
  if (!phone) return matches(SIDEWAYS_QUERY, device) ? 'sideways desktop?' : 'desktop';
  return matches(SIDEWAYS_QUERY, device) ? 'phone, sideways' : 'phone';
};

const touch = (width: number, height: number, screen: [number, number]): Device => ({
  width,
  height,
  screen,
  pointer: 'coarse',
});

const IPHONE: [number, number] = [390, 844];
const ANDROID_UPRIGHT: [number, number] = [412, 915];
const ANDROID_SIDEWAYS: [number, number] = [915, 412];
const TABLET_SIDEWAYS: [number, number] = [1280, 800];

const devices: Array<[string, Device, string]> = [
  ['iPhone 13 upright', touch(390, 844, IPHONE), 'phone'],
  ['iPhone 13 sideways', touch(844, 390, IPHONE), 'phone, sideways'],
  ['iPhone 13 sideways in Safari', touch(874, 296, [402, 874]), 'phone, sideways'],
  ['iPhone 13 sideways, keyboard open', touch(844, 150, IPHONE), 'phone, sideways'],
  ['iPhone Pro Max sideways', touch(932, 430, [430, 932]), 'phone, sideways'],
  ['iPhone SE (2nd, 3rd gen) sideways', touch(667, 375, [375, 667]), 'phone, sideways'],
  // Under 600px wide even sideways: the phone layout without the sideways rules.
  ['iPhone SE (1st gen) sideways', touch(568, 320, [320, 568]), 'phone'],
  ['Galaxy S9+ sideways', touch(658, 320, [658, 320]), 'phone, sideways'],
  ['Galaxy A55 at a small display size, upright', touch(480, 1000, [480, 1040]), 'phone'],
  [
    'Galaxy A55 at a small display size, sideways',
    touch(1040, 440, [1040, 480]),
    'phone, sideways',
  ],
  ['a phone 560px on its short side, upright', touch(560, 1180, [560, 1240]), 'phone'],
  ['a phone 560px on its short side, sideways', touch(1240, 520, [1240, 560]), 'phone, sideways'],
  ['a screen 599.5px on its short side', touch(1000, 540, [1000, 599.5]), 'phone, sideways'],
  ['a screen 600.5px on its short side', touch(1000, 540, [1000, 600.5]), 'desktop'],
  ['Android phone upright', touch(412, 915, ANDROID_UPRIGHT), 'phone'],
  ['Android phone upright, keyboard open', touch(412, 520, ANDROID_UPRIGHT), 'phone'],
  ['Android phone sideways', touch(915, 412, ANDROID_SIDEWAYS), 'phone, sideways'],
  ['Android phone sideways, keyboard open', touch(915, 180, ANDROID_SIDEWAYS), 'phone, sideways'],
  ['iPad mini upright (under 768px, as before)', touch(744, 1133, [744, 1133]), 'phone'],
  ['iPad mini sideways', touch(1133, 744, [744, 1133]), 'desktop'],
  ['iPad upright', touch(768, 1024, [768, 1024]), 'desktop'],
  ['iPad Air sideways', touch(1180, 820, [820, 1180]), 'desktop'],
  ['iPad Air sideways, keyboard open', touch(1180, 420, [820, 1180]), 'desktop'],
  ['Android tablet sideways', touch(1280, 712, TABLET_SIDEWAYS), 'desktop'],
  ['Android tablet sideways, keyboard open', touch(1280, 380, TABLET_SIDEWAYS), 'desktop'],
  ['Android tablet upright, keyboard open', touch(800, 900, [800, 1280]), 'desktop'],
  ['small Android tablet sideways, keyboard open', touch(960, 250, [960, 600]), 'desktop'],
  ['7-inch Android tablet sideways', touch(1024, 552, [1024, 600]), 'desktop'],
  // Under 768px wide, as before.
  ['7-inch Android tablet upright', touch(600, 976, [600, 1024]), 'phone'],
  ['desktop', { width: 1280, height: 800, screen: [1920, 1080], pointer: 'fine' }, 'desktop'],
  [
    'short desktop window',
    { width: 1024, height: 420, screen: [1440, 900], pointer: 'fine' },
    'desktop',
  ],
  [
    'narrow desktop window',
    { width: 600, height: 800, screen: [1440, 900], pointer: 'fine' },
    'phone',
  ],
  [
    'desktop window 767.5px wide',
    { width: 767.5, height: 800, screen: [1440, 900], pointer: 'fine' },
    'phone',
  ],
  [
    'desktop window 768.25px wide',
    { width: 768.25, height: 800, screen: [1440, 900], pointer: 'fine' },
    'desktop',
  ],
  [
    'small screen with no pointer',
    { width: 1024, height: 420, screen: [1024, 420], pointer: 'none' },
    'desktop',
  ],
];

describe('regression: a phone turned sideways keeps the phone layout, a tablet the desktop one', () => {
  it.each(devices)('%s', (_name, device, layout) => {
    expect(layoutOf(device)).toBe(layout);
  });
});

const SRC = join(import.meta.dirname, '../../src');
// The phone/desktop breakpoint, the screen's size, and the sideways phone's width.
const LAYOUT_FEATURE = /76[78]px|device-|600px|540px/;
const LAYOUT_QUERIES = [PHONE_QUERY, DESKTOP_QUERY, SIDEWAYS_QUERY];

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

it('uses the same phone, desktop and sideways queries in every stylesheet as in the code', () => {
  const strays = cssFiles(SRC).flatMap((path) =>
    mediaQueries(path)
      .filter((query) => LAYOUT_FEATURE.test(query))
      .filter((query) => !LAYOUT_QUERIES.includes(query))
      .map((query) => `${relative(SRC, path)}: ${query}`),
  );
  expect(strays).toEqual([]);
});
