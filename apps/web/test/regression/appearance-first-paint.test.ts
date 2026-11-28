import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { APPEARANCE_STORAGE_KEY, type Appearance } from '../../src/appearance';
import { STATUS_BAR_STYLES, THEME_COLORS } from '../../src/appearance/themeMeta';
import { APPEARANCES, tokenValue } from './contrast';

const INDEX = readFileSync(join(import.meta.dirname, '../../index.html'), 'utf8');
const SCRIPT = /<script>([\s\S]*?)<\/script>/.exec(INDEX)?.[1] ?? '';
const metaIn = (html: string, name: string) =>
  new RegExp(`<meta name="${name}" content="([^"]*)"`).exec(html)?.[1];
const meta = (name: string) =>
  document.querySelector(`meta[name="${name}"]`)?.getAttribute('content');

interface Visit {
  stored: string | null | Error;
  systemDark: boolean;
}

// index.html's inline script, run as the browser runs it before the stylesheet and the app load.
function firstPaint({ stored, systemDark }: Visit): void {
  const window = {
    localStorage: {
      getItem: (key: string) => {
        if (stored instanceof Error) throw stored;

        return key === APPEARANCE_STORAGE_KEY ? stored : null;
      },
    },
    matchMedia: (query: string) => ({
      matches: query === '(prefers-color-scheme: dark)' && systemDark,
    }),
  };
  runInNewContext(SCRIPT, { window, document });
}

beforeEach(() => {
  document.head.innerHTML = [
    `<meta name="theme-color" content="${metaIn(INDEX, 'theme-color')}" />`,
    `<meta name="apple-mobile-web-app-status-bar-style" content="${metaIn(INDEX, 'apple-mobile-web-app-status-bar-style')}" />`,
  ].join('');
});

afterEach(() => {
  document.head.innerHTML = '';
  delete document.documentElement.dataset.appearance;
});

const expectAppearance = (appearance: Appearance) => {
  expect(document.documentElement).toHaveAttribute('data-appearance', appearance);
  expect(meta('theme-color')).toBe(THEME_COLORS[appearance]);
  expect(meta('apple-mobile-web-app-status-bar-style')).toBe(STATUS_BAR_STYLES[appearance]);
};

describe('regression: the page is dark before its first paint, so it never flashes white', () => {
  it.each<[Visit, Appearance]>([
    [{ stored: null, systemDark: true }, 'dark'],
    [{ stored: null, systemDark: false }, 'light'],
    [{ stored: 'system', systemDark: true }, 'dark'],
    [{ stored: 'dark', systemDark: false }, 'dark'],
    [{ stored: 'light', systemDark: true }, 'light'],
    [{ stored: new DOMException('blocked', 'SecurityError'), systemDark: true }, 'dark'],
  ])('%o shows %s', (visit, appearance) => {
    firstPaint(visit);
    expectAppearance(appearance);
  });

  it('reads the key the Account choice is stored under', () => {
    expect(SCRIPT).toContain(`'${APPEARANCE_STORAGE_KEY}'`);
  });

  it('starts from the light meta values the app sets', () => {
    expect(metaIn(INDEX, 'theme-color')).toBe(THEME_COLORS.light);
    expect(metaIn(INDEX, 'apple-mobile-web-app-status-bar-style')).toBe(STATUS_BAR_STYLES.light);
  });

  it.each(APPEARANCES)('gives the browser’s bars the %s page color', (appearance) => {
    expect(THEME_COLORS[appearance]).toBe(tokenValue('--page', appearance));
  });
});
