import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { SIDEWAYS_QUERY } from '../../src/lib/media';

// PT-252, from Run all's Device chip (054186c): a row more of chips put a comment's Show less
// under the bottom bar and the comment jump. Scrolled "into view" there, it took no tap, so the
// screen scrolled again as it was pressed and the closing text no longer kept it in place.

const css = (path: string): string =>
  readFileSync(join(import.meta.dirname, '../../src', path), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ');

const tokenValues = (): string[] =>
  [...css('design/tokens.css').matchAll(/--bottom-bar-height: ([^;]+);/g)].map((m) => m[1]!);

it('pads the stack scroller by the bottom bar while the bar shows', () => {
  expect(css('navigation/StackNavigator.module.css')).toContain(
    '.scroller:has([data-bottom-bar]:not([data-hidden])) { scroll-padding-bottom: var(--bottom-bar-height); }',
  );
});

it('measures the bar as the bar is drawn, upright and sideways', () => {
  const bar = css('navigation/BottomBar.module.css');
  expect(bar).toContain(
    'padding: 10px calc(var(--space-4) + var(--safe-right)) calc(10px + var(--safe-bottom))',
  );
  expect(bar).toContain('border-top: 1px solid');
  expect(bar).toContain(
    `@media ${SIDEWAYS_QUERY} { .bar { padding-top: 6px; padding-bottom: max(6px, var(--safe-bottom)); } }`,
  );
  expect(tokenValues()).toEqual([
    'calc(var(--bar-button) + 21px + var(--safe-bottom))',
    'calc(var(--bar-button) + 7px + max(6px, var(--safe-bottom)))',
  ]);
});
