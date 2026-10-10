import { describe, expect, it } from 'vitest';
import { textLines } from './stepClamp';

const text = { kind: 'text' } as const;

describe('textLines', () => {
  it("shows Claude's newest words whole while it works, and earlier ones cut to 3 lines", () => {
    expect(textLines('live', text, true)).toBeNull();
    expect(textLines('live', text, false)).toBe(3);
  });

  it("keeps a folded answer's words to 2 lines and a sheet's whole", () => {
    expect(textLines('history', text, true)).toBe(2);
    expect(textLines('full', text, false)).toBeNull();
  });

  it('never cuts a call, which is one line already', () => {
    expect(textLines('live', { kind: 'tool' }, false)).toBeNull();
    expect(textLines('history', { kind: 'denied' }, false)).toBeNull();
  });
});
