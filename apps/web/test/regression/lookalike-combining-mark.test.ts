import { describe, expect, it } from 'vitest';
import { markHidden } from '../../src/features/requests/hiddenChars';

// A combining mark after a marked letter sat on the next letter: 'pа́y' showed 'p\u{430}ý', with
// the acute on the Latin y (PT-169 review).
describe('a combining mark after a marked letter', () => {
  it('shows as its code in the same token', () => {
    expect(markHidden('cat pа́y.txt')).toEqual([
      { kind: 'text', text: 'cat p' },
      { kind: 'lookalike', text: '\\u{430}\\u{301}' },
      { kind: 'text', text: 'y.txt' },
    ]);
    expect(markHidden('a​́b')).toEqual([
      { kind: 'text', text: 'a' },
      { kind: 'hidden', text: '\\u{200B}\\u{301}' },
      { kind: 'text', text: 'b' },
    ]);
  });
});
