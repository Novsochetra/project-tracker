import { describe, expect, it } from 'vitest';
import { searchQuery } from '../src/api/search';
import {
  containsPattern,
  escapeLike,
  parseKeyQuery,
  SEARCH_TERMS_MAX,
  searchMatchOf,
  searchSnippet,
  searchTerms,
} from '../src/logic/search';

describe('searchTerms', () => {
  it('lowercases, splits on spaces and drops repeats', () => {
    expect(searchTerms('  Login   CRASH login ')).toEqual(['login', 'crash']);
    expect(searchTerms('   ')).toEqual([]);
  });

  it('keeps at most a few words', () => {
    expect(searchTerms('a b c d e f g')).toHaveLength(SEARCH_TERMS_MAX);
  });
});

describe('parseKeyQuery', () => {
  it('reads a ticket key written several ways', () => {
    for (const text of ['PT-12', 'pt-12', 'pt 12', 'pt12', ' Pt - 12 ']) {
      expect(parseKeyQuery(text), text).toEqual({ projectKey: 'PT', num: 12 });
    }
  });

  it('reads a key with digits in it', () => {
    expect(parseKeyQuery('MOB2-7')).toEqual({ projectKey: 'MOB2', num: 7 });
  });

  it('reads a bare number as a number in any project', () => {
    expect(parseKeyQuery('12')).toEqual({ projectKey: null, num: 12 });
    expect(parseKeyQuery('#12')).toEqual({ projectKey: null, num: 12 });
  });

  it('reads nothing from words or numbers out of range', () => {
    expect(parseKeyQuery('login crash')).toBeNull();
    expect(parseKeyQuery('PT')).toBeNull();
    expect(parseKeyQuery('0')).toBeNull();
    expect(parseKeyQuery('PT-99999999999')).toBeNull();
  });
});

describe('escapeLike', () => {
  it('escapes the LIKE wildcards and the escape character', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
    expect(containsPattern('a_b')).toBe('%a\\_b%');
  });
});

describe('searchMatchOf', () => {
  it('ranks a key hit, then every word in the title, then the rest', () => {
    expect(searchMatchOf('Anything', ['x'], true)).toBe('key');
    expect(searchMatchOf('Login crash on iOS', ['crash', 'login'], false)).toBe('title');
    expect(searchMatchOf('Login crash', ['crash', 'android'], false)).toBe('description');
    expect(searchMatchOf('Login', [], false)).toBe('recent');
  });
});

describe('searchSnippet', () => {
  it('shows the text around the first matching word, on one line', () => {
    const text = `${'word '.repeat(40)}the app\ncrashes on rotate ${'tail '.repeat(40)}`;
    const snippet = searchSnippet(text, ['rotate', 'crashes'])!;
    expect(snippet.startsWith('…')).toBe(true);
    expect(snippet.endsWith('…')).toBe(true);
    expect(snippet).toContain('the app crashes on rotate');
    expect(snippet.length).toBeLessThan(170);
  });

  it('keeps a short text whole', () => {
    expect(searchSnippet('Steps: open, rotate.', ['rotate'])).toBe('Steps: open, rotate.');
  });

  it('is null when no word is in the text', () => {
    expect(searchSnippet('Nothing here', ['rotate'])).toBeNull();
  });
});

describe('searchQuery', () => {
  it('defaults and bounds the limit', () => {
    expect(searchQuery.parse({})).toEqual({ q: '', limit: 30 });
    expect(searchQuery.parse({ q: 'x', limit: '5' })).toEqual({ q: 'x', limit: 5 });
    expect(searchQuery.safeParse({ limit: '500' }).success).toBe(false);
    expect(searchQuery.safeParse({ q: 'x'.repeat(201) }).success).toBe(false);
  });
});
