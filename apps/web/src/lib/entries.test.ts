import { describe, expect, it } from 'vitest';
import { entriesOf, isEntry, readableEntries } from './entries';

describe('readableEntries', () => {
  it('keeps the objects in order and leaves out what isn’t one', () => {
    const a = { id: 'a' };
    const b = { id: 'b' };
    const list = [a, null, 7, 'text', undefined, b] as unknown as Array<{ id: string }>;
    expect(readableEntries(list)).toEqual([a, b]);
  });

  it('tells an object entry from anything else', () => {
    expect(isEntry({})).toBe(true);
    expect(isEntry([])).toBe(false);
    expect(isEntry(null)).toBe(false);
    expect(isEntry('a')).toBe(false);
  });
});

describe('entriesOf', () => {
  it('reads a list field, and gives none for one that is not a list', () => {
    const a = { id: 'a' };
    expect(entriesOf([null, a] as Array<{ id: string }>)).toEqual([a]);
    expect(entriesOf(null)).toEqual([]);
    expect(entriesOf({} as unknown as Array<{ id: string }>)).toEqual([]);
  });
});
