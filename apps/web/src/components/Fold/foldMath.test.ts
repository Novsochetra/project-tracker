import { describe, expect, it } from 'vitest';
import { FOLD_LINES, foldedHeight, lineHeightOf } from './foldMath';

const LINE = 21;

describe('foldedHeight', () => {
  it('folds text longer than about eight lines to eight lines', () => {
    expect(foldedHeight({ text: 40 * LINE, lineHeight: LINE, frame: 0 })).toBe(FOLD_LINES * LINE);
  });

  it('leaves text that a fold would barely shorten as it is', () => {
    expect(foldedHeight({ text: 8 * LINE, lineHeight: LINE, frame: 0 })).toBeNull();
    expect(foldedHeight({ text: 11 * LINE, lineHeight: LINE, frame: 0 })).toBeNull();
    expect(foldedHeight({ text: 11 * LINE + 1, lineHeight: LINE, frame: 0 })).toBe(168);
  });

  it('keeps the padding and borders of a field around the folded lines', () => {
    const lineHeight = 26.4;
    expect(foldedHeight({ text: 30 * lineHeight, lineHeight, frame: 14 })).toBe(225);
  });

  it('ends on the last line that fits when the text runs on lines of its own', () => {
    const reportLines = Array.from({ length: 30 }, (_, index) => index * 20 + 18);
    expect(foldedHeight({ text: 600, lineHeight: LINE, frame: 0, lineEnds: reportLines })).toBe(
      158,
    );
  });

  it('never folds when the line height is unknown', () => {
    expect(foldedHeight({ text: 1000, lineHeight: Number.NaN, frame: 0 })).toBeNull();
    expect(foldedHeight({ text: 1000, lineHeight: 0, frame: 0 })).toBeNull();
  });
});

describe('lineHeightOf', () => {
  it('reads the line height the browser computed', () => {
    expect(lineHeightOf('26.4px', '16px')).toBe(26.4);
  });

  it('takes "normal" as 1.2 times the font size', () => {
    expect(lineHeightOf('normal', '20px')).toBe(24);
  });

  it('falls back to the body text line when nothing is computed', () => {
    expect(lineHeightOf('', '')).toBe(21);
  });
});
