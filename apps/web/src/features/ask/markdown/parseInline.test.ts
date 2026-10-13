import { describe, expect, it } from 'vitest';
import { MAX_INLINE_DEPTH } from './buildInline';
import { parseInline } from './parseInline';
import type { Inline } from './types';

const text = (value: string): Inline => ({ kind: 'text', text: value });
const strong = (...children: Inline[]): Inline => ({ kind: 'strong', children });
const em = (...children: Inline[]): Inline => ({ kind: 'em', children });
const code = (value: string): Inline => ({ kind: 'code', text: value });
const link = (label: string, href = label): Inline => ({ kind: 'link', text: label, href });

describe('parseInline', () => {
  it('reads bold, italic and both', () => {
    expect(parseInline('a **b** *c* __d__ _e_ ***f***')).toEqual([
      text('a '),
      strong(text('b')),
      text(' '),
      em(text('c')),
      text(' '),
      strong(text('d')),
      text(' '),
      em(text('e')),
      text(' '),
      em(strong(text('f'))),
    ]);
  });

  it('nests emphasis', () => {
    expect(parseInline('**bold *and italic***')).toEqual([
      strong(text('bold '), em(text('and italic'))),
    ]);
  });

  it('keeps marks that open or close nothing as text', () => {
    expect(parseInline('2 * 3 * 4, **open, close**')).toEqual([
      text('2 * 3 * 4, '),
      strong(text('open, close')),
    ]);
    expect(parseInline('a ** b')).toEqual([text('a ** b')]);
    expect(parseInline('**a')).toEqual([text('**a')]);
  });

  it('keeps underscores inside words', () => {
    expect(parseInline('snake_case_name and _this_')).toEqual([
      text('snake_case_name and '),
      em(text('this')),
    ]);
  });

  it('never lets two kinds of emphasis cross', () => {
    expect(parseInline('*a _b* c_')).toEqual([em(text('a _b')), text(' c_')]);
  });

  it('reads code spans first, so marks and links in them stay as written', () => {
    expect(parseInline('run `npm *run* https://x.dev` and ``a ` b``')).toEqual([
      text('run '),
      code('npm *run* https://x.dev'),
      text(' and '),
      code('a ` b'),
    ]);
    expect(parseInline('**`code`**')).toEqual([strong(code('code'))]);
  });

  it('keeps a backtick that closes nothing', () => {
    expect(parseInline('a ` b')).toEqual([text('a ` b')]);
  });

  it('links web addresses by linkify’s rules', () => {
    expect(parseInline('see https://x.dev/a_b_c. and **https://x.dev/b**')).toEqual([
      text('see '),
      link('https://x.dev/a_b_c'),
      text('. and '),
      strong(link('https://x.dev/b')),
    ]);
  });

  it('reads Markdown links to web addresses only', () => {
    expect(parseInline('[docs](https://x.dev/docs) [bad](javascript:alert(1))')).toEqual([
      link('docs', 'https://x.dev/docs'),
      text(' [bad](javascript:alert(1))'),
    ]);
  });

  it('shows a backslashed mark as the mark', () => {
    expect(parseInline('\\*not italic\\*')).toEqual([text('*not italic*')]);
  });

  it('keeps HTML as text', () => {
    const html = '<script>alert(1)</script><img src=x onerror=alert(1)>';
    expect(parseInline(html)).toEqual([text(html)]);
  });

  it('shows emphasis deeper than the limit as its marks', () => {
    const depth = MAX_INLINE_DEPTH + 2;
    const nested = `${'*a '.repeat(depth)}b${' c*'.repeat(depth)}`;
    let level = parseInline(nested);
    let levels = 0;
    while (level.some((inline) => inline.kind === 'em')) {
      const inner = level.find((inline) => inline.kind === 'em')!;
      level = inner.kind === 'em' ? inner.children : [];
      levels += 1;
    }
    expect(levels).toBe(MAX_INLINE_DEPTH);
    expect(level).toEqual([text('a *a *a b c* c* c')]);
  });
});
