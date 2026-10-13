import { describe, expect, it } from 'vitest';
import { localNames } from '../../src/watch/ask/askFileNames';

const key = (name: string) => name.normalize('NFC').toLowerCase();
const allApart = (names: string[]) => new Set(names.map(key)).size === names.length;

// Two files written under one name failed the run with "Couldn't get a.png from the tracker:
// EEXIST": the numbered name could match a name sent as it is, and NFC and NFD forms of one name
// are one file on APFS.
describe('regression: two files of one question never get one name', () => {
  it('keeps a numbered name apart from a file sent under that name', () => {
    const names = localNames(['a.png', '3-a.png', 'a.png']);
    expect(allApart(names)).toBe(true);
    expect(names.slice(0, 2)).toEqual(['a.png', '3-a.png']);
  });

  it('counts the NFC and NFD forms of a name as one name', () => {
    const names = localNames(['café.png', 'café.png']);
    expect(allApart(names)).toBe(true);
    expect(names[0]).toBe('café.png');
  });
});
