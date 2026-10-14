import { describe, expect, it } from 'vitest';
import { keepsLocation, withWithheldFiles } from '../src/logic/withheldFiles';

describe('withheld files', () => {
  it('holds back only images the tracker keeps as they came', () => {
    expect(['image/heic', 'image/heif'].map(keepsLocation)).toEqual([true, true]);
    const others = [
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp',
      'text/plain',
      'video/mp4',
    ];
    expect(others.map(keepsLocation)).toEqual(others.map(() => false));
  });

  it('tells Claude after the prompt, and leaves a prompt with none alone', () => {
    expect(withWithheldFiles('Q', [])).toBe('Q');
    expect(withWithheldFiles('Q', ['IMG_1.heic'])).toBe(
      'Q\n\nIMG_1.heic was not passed to you: the tracker cannot remove its location.',
    );
    expect(withWithheldFiles('Q', ['a.heic', 'b.heif'])).toBe(
      'Q\n\na.heic, b.heif were not passed to you: the tracker cannot remove their location.',
    );
  });
});
