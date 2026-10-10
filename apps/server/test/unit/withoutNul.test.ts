import { describe, expect, it } from 'vitest';
import { withoutNul, withoutNulInJson } from '../../src/withoutNul';

describe('withoutNul', () => {
  it('drops every NUL from a string and leaves other values alone', () => {
    expect(withoutNul('\u0000Cr\u0000\u0000ash\u0000')).toBe('Crash');
    expect(withoutNul('Crash')).toBe('Crash');
    expect(withoutNul(42)).toBe(42);
    expect(withoutNul(null)).toBeNull();
    const bytes = new Uint8Array([0, 1]);
    expect(withoutNul(bytes)).toBe(bytes);
  });
});

describe('withoutNulInJson', () => {
  it('drops NULs from the strings at any depth', () => {
    const body = JSON.parse(
      '{"title":"Cr\\u0000ash","ids":["a\\u0000","b"],"expected":{"title":"x\\u0000"},"n":1,"ok":true,"none":null}',
    ) as unknown;
    expect(withoutNulInJson(body)).toEqual({
      title: 'Crash',
      ids: ['a', 'b'],
      expected: { title: 'x' },
      n: 1,
      ok: true,
      none: null,
    });
    expect(withoutNulInJson('Lo\u0000gs')).toBe('Logs');
  });

  it('keeps a __proto__ key a plain field', () => {
    const body = JSON.parse('{"__proto__":{"polluted":"y\\u0000"}}') as unknown;
    const cleaned = withoutNulInJson(body) as Record<string, unknown>;
    expect(Object.getPrototypeOf(cleaned)).toBe(Object.prototype);
    expect(Object.getOwnPropertyDescriptor(cleaned, '__proto__')?.value).toEqual({
      polluted: 'y',
    });
  });
});
