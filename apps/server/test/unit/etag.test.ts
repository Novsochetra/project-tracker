import { describe, expect, it } from 'vitest';
import { etagMatches, etagOf } from '../../src/http/etag';

describe('etagOf', () => {
  it('gives the same bytes the same weak tag and other bytes another', () => {
    const tag = etagOf(Buffer.from('forty-two'));
    expect(tag).toMatch(/^W\/"[\w-]+"$/);
    expect(etagOf(Buffer.from('forty-two'))).toBe(tag);
    expect(etagOf(Buffer.from('forty-six'))).not.toBe(tag);
  });
});

describe('etagMatches', () => {
  const tag = 'W/"abc"';

  it('compares weakly, as If-None-Match does', () => {
    expect(etagMatches('W/"abc"', tag)).toBe(true);
    expect(etagMatches('"abc"', tag)).toBe(true);
    expect(etagMatches('W/"abd"', tag)).toBe(false);
  });

  it('finds the tag in a list', () => {
    expect(etagMatches('"x", W/"abc" ,"y"', tag)).toBe(true);
    expect(etagMatches('"x","y"', tag)).toBe(false);
  });

  it('matches anything for *, and nothing without the header', () => {
    expect(etagMatches('*', tag)).toBe(true);
    expect(etagMatches(undefined, tag)).toBe(false);
    expect(etagMatches('', tag)).toBe(false);
  });
});
