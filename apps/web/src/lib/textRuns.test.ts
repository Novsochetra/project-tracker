import { describe, expect, it } from 'vitest';
import { MAX_RUN, textRuns } from './textRuns';

describe('textRuns', () => {
  it('keeps text up to the limit whole', () => {
    expect(textRuns('')).toEqual(['']);
    expect(textRuns('Fixed it.')).toEqual(['Fixed it.']);
    expect(textRuns('a'.repeat(MAX_RUN))).toEqual(['a'.repeat(MAX_RUN)]);
  });

  it('splits longer text into runs of at most the limit', () => {
    const runs = textRuns(')'.repeat(2 * MAX_RUN + 5));
    expect(runs.map((run) => run.length)).toEqual([MAX_RUN, MAX_RUN, 5]);
  });

  it('moves a split that would fall inside a grapheme to its start', () => {
    const text = `${'a'.repeat(MAX_RUN - 1)}é${'b'.repeat(10)}`;
    expect(textRuns(text)).toEqual(['a'.repeat(MAX_RUN - 1), `é${'b'.repeat(10)}`]);
    const emoji = `${'a'.repeat(MAX_RUN - 1)}😀b`;
    expect(textRuns(emoji)).toEqual(['a'.repeat(MAX_RUN - 1), '😀b']);
  });

  it('keeps a grapheme longer than the limit whole rather than looping', () => {
    const zalgo = `a${'́'.repeat(MAX_RUN + 10)}`;
    const text = `${zalgo}tail`;
    expect(textRuns(text)).toEqual([zalgo, 'tail']);
    expect(textRuns(zalgo)).toEqual([zalgo]);
  });
});
