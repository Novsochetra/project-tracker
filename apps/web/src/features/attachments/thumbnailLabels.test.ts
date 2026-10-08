import { describe, expect, it } from 'vitest';
import { formatDuration, thumbnailLabels } from './thumbnailLabels';

const file = (fileName: string, mimeType: string) => ({ fileName, mimeType });

describe('thumbnailLabels', () => {
  it('numbers images and videos by kind and names other files', () => {
    expect(
      thumbnailLabels([
        file('a.png', 'image/png'),
        file('clip.mov', 'video/quicktime'),
        file('notes.txt', 'text/plain'),
        file('b.jpg', 'image/jpeg'),
        file('spec.pdf', 'application/pdf'),
        file('c.webm', 'video/webm'),
      ]),
    ).toEqual(['image 1', 'video 1', 'notes.txt', 'image 2', 'spec.pdf', 'video 2']);
  });
});

describe('formatDuration', () => {
  it('shows minutes and seconds, and hours when there are any', () => {
    expect(formatDuration(4.6)).toBe('0:05');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(720)).toBe('12:00');
    expect(formatDuration(3723)).toBe('1:02:03');
  });

  it('shows nothing for a length that is not known', () => {
    expect(formatDuration(Number.NaN)).toBeNull();
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBeNull();
    expect(formatDuration(-1)).toBeNull();
  });
});
