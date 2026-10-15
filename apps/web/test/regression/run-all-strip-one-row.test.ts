import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { SIDEWAYS_QUERY } from '../../src/lib/media';
import { phoneRule } from './phoneCss';

// PT-252, from PT-227: the Run all strip wrapped its button under the counts on a 375px phone,
// a row that moved every ticket down (a double tap on Undo then landed on a group's header), and
// sideways it took the room the first ticket needed under Safari's bars.

const STRIP = 'features/project/RunAllStrip.module.css';

const sidewaysBody = (): string => {
  const css = readFileSync(join(import.meta.dirname, '../../src', STRIP), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ');
  const at = css.indexOf(`@media ${SIDEWAYS_QUERY} {`);
  return at === -1 ? '' : css.slice(at);
};

it('keeps the counts and Run all on one row on phones', () => {
  expect(phoneRule(STRIP, '.strip').get('flex-wrap') ?? 'nowrap').toBe('nowrap');
  expect(phoneRule(STRIP, '.button').get('flex')).toBe('none');
  expect(phoneRule(STRIP, '.counts').get('min-width')).toBe('0');
});

it('hides the strip on a sideways phone', () => {
  expect(sidewaysBody()).toMatch(/^@media [^{]+\{ \.strip \{ display: none; \}/);
});
