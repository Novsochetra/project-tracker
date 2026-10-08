import { describe, expect, it } from 'vitest';
import { carriesFiles, filesOf, isImageFile, partitionImages } from './imageFiles';

const file = (name: string, type: string) => new File(['x'], name, { type });

function transfer(files: File[], options: { asItems?: boolean; types?: string[] } = {}) {
  const items = files.map((item) => ({ kind: 'file', getAsFile: () => item }));
  return {
    files: options.asItems ? [] : files,
    items: [...items, { kind: 'string', getAsFile: () => null }],
    types: options.types ?? ['Files'],
  } as unknown as DataTransfer;
}

describe('isImageFile', () => {
  it('accepts the image types the server stores', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/heic']) {
      expect(isImageFile(file('a', type))).toBe(true);
    }
  });

  it('rejects other types', () => {
    expect(isImageFile(file('notes.pdf', 'application/pdf'))).toBe(false);
    expect(isImageFile(file('vector.svg', 'image/svg+xml'))).toBe(false);
  });

  it('falls back to the name when the browser gives no type', () => {
    expect(isImageFile(file('IMG_0001.HEIC', ''))).toBe(true);
    expect(isImageFile(file('notes.txt', ''))).toBe(false);
  });
});

describe('partitionImages', () => {
  it('splits images from everything else, keeping the order', () => {
    const a = file('a.png', 'image/png');
    const b = file('b.pdf', 'application/pdf');
    const c = file('c.jpg', 'image/jpeg');
    expect(partitionImages([a, b, c])).toEqual({ images: [a, c], rejected: [b] });
  });
});

describe('filesOf', () => {
  it('reads the file list', () => {
    const shot = file('shot.png', 'image/png');
    expect(filesOf(transfer([shot]))).toEqual([shot]);
  });

  it('falls back to file items when the list is empty, as some pastes are', () => {
    const shot = file('shot.png', 'image/png');
    expect(filesOf(transfer([shot], { asItems: true }))).toEqual([shot]);
  });

  it('returns nothing without data', () => {
    expect(filesOf(null)).toEqual([]);
  });
});

describe('carriesFiles', () => {
  it('is true only for file drags', () => {
    expect(carriesFiles(transfer([], { types: ['Files'] }))).toBe(true);
    expect(carriesFiles(transfer([], { types: ['text/plain'] }))).toBe(false);
    expect(carriesFiles(null)).toBe(false);
  });
});
