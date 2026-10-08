import { describe, expect, it } from 'vitest';
import { formatDuration, splitFileName, thumbnailLabels } from './thumbnailLabels';

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

describe('splitFileName', () => {
  it('keeps the extension and the characters just before it together', () => {
    expect(splitFileName('crash-report-1.log')).toEqual({ head: 'crash-repo', tail: 'rt-1.log' });
    expect(splitFileName('IMG_0001.HEIC')).toEqual({ head: 'IMG_', tail: '0001.HEIC' });
    expect(splitFileName('archive.tar.gz')).toEqual({ head: 'archive', tail: '.tar.gz' });
  });

  it('keeps a short name whole in the part that never shrinks', () => {
    expect(splitFileName('spec.pdf')).toEqual({ head: '', tail: 'spec.pdf' });
    expect(splitFileName('.env')).toEqual({ head: '', tail: '.env' });
  });

  it('keeps the end of a name without an extension', () => {
    expect(splitFileName('Makefile')).toEqual({ head: 'Make', tail: 'file' });
  });

  it('counts a character made of two code units once and never splits it', () => {
    expect(splitFileName('notes 🐞🐞.txt')).toEqual({ head: 'note', tail: 's 🐞🐞.txt' });
  });
});
