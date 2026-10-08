import { describe, expect, it } from 'vitest';
import { isEntry, readableEntries } from './entries';

describe('readableEntries', () => {
  it('keeps the objects in order and leaves out what isn’t one', () => {
    const a = { id: 'a' };
    const b = { id: 'b' };
    const list = [a, null, 7, 'text', undefined, b] as unknown as Array<{ id: string }>;
    expect(readableEntries(list)).toEqual([a, b]);
  });

  it('tells an object entry from anything else', () => {
    expect(isEntry({})).toBe(true);
    expect(isEntry([])).toBe(true);
    expect(isEntry(null)).toBe(false);
    expect(isEntry('a')).toBe(false);
  });
});
