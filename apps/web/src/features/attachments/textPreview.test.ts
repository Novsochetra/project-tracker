import { describe, expect, it } from 'vitest';
import { TEXT_PREVIEW_MAX_CHARS, textPreview } from './textPreview';

describe('textPreview', () => {
  it('shows a file that fits whole', () => {
    expect(textPreview('line one\nline two')).toEqual({ text: 'line one\nline two', cut: false });
    const exact = 'x'.repeat(TEXT_PREVIEW_MAX_CHARS);
    expect(textPreview(exact)).toEqual({ text: exact, cut: false });
  });

  it('cuts a longer file on the last whole line before the limit', () => {
    const line = `${'x'.repeat(99)}\n`;
    const text = line.repeat(TEXT_PREVIEW_MAX_CHARS / 100 + 5);
    const preview = textPreview(text);
    expect(preview.cut).toBe(true);
    expect(preview.text).toBe(line.repeat(TEXT_PREVIEW_MAX_CHARS / 100 - 1) + 'x'.repeat(99));
  });

  it('cuts at the limit when no line ends near it', () => {
    const preview = textPreview('y'.repeat(TEXT_PREVIEW_MAX_CHARS + 10));
    expect(preview).toEqual({ text: 'y'.repeat(TEXT_PREVIEW_MAX_CHARS), cut: true });
  });

  it('never splits a character made of two code units', () => {
    const text = `${'z'.repeat(TEXT_PREVIEW_MAX_CHARS - 1)}📄 and more`;
    expect(textPreview(text).text).toBe('z'.repeat(TEXT_PREVIEW_MAX_CHARS - 1));
  });
});
