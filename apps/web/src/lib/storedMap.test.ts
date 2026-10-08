import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseMap, storedMap } from './storedMap';

const KEY = 'test.map';
const isText = (value: unknown): value is string => typeof value === 'string';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('parseMap', () => {
  it('keeps only the entries that pass the check, and reads anything else as empty', () => {
    expect(parseMap('{"a":"one","b":2}', isText)).toEqual({ a: 'one' });
    expect(parseMap('not json', isText)).toEqual({});
    expect(parseMap('null', isText)).toEqual({});
    expect(parseMap(null, isText)).toEqual({});
  });
});

describe('storedMap', () => {
  it('parses again only when the stored text changed, such as by another tab', () => {
    const map = storedMap(KEY, isText);
    map.write({ a: 'one' });
    const first = map.read();
    expect(map.read()).toBe(first);
    localStorage.setItem(KEY, JSON.stringify({ a: 'one', b: 'two' }));
    expect(map.read()).toEqual({ a: 'one', b: 'two' });
  });

  it('removes the key once the map is empty', () => {
    const map = storedMap(KEY, isText);
    map.write({ a: 'one' });
    expect(map.write({})).toBe(true);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('says when storage refuses a write, and reads as empty without storage', () => {
    const map = storedMap(KEY, isText);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });
    expect(map.write({ a: 'one' })).toBe(false);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Turned off', 'SecurityError');
    });
    expect(map.read()).toEqual({});
  });
});
