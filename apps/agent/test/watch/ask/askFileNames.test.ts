import { describe, expect, it } from 'vitest';
import { localNames } from '../../../src/watch/ask/askFileNames';

describe('localNames', () => {
  it('keeps plain names as they are', () => {
    expect(localNames(['board.jpg', 'crash log.txt', 'café.pdf'])).toEqual([
      'board.jpg',
      'crash log.txt',
      'café.pdf',
    ]);
  });

  it('never lets a name reach outside the folder or hide', () => {
    expect(localNames(['../../.ssh/id_rsa', '..', '.env', 'a\\b.txt', 'x\u0000y.txt'])).toEqual([
      '_.._.ssh_id_rsa',
      'file-2',
      'env',
      'a_b.txt',
      'x_y.txt',
    ]);
  });

  it('names a file with no usable name, or one too long to store, by its place', () => {
    expect(localNames(['', '   ', `${'写'.repeat(200)}.png`])).toEqual([
      'file-1',
      'file-2',
      'file-3.png',
    ]);
  });

  it('gives a repeated name its place in front, whatever its case', () => {
    expect(localNames(['IMG.jpg', 'img.JPG', 'IMG.jpg'])).toEqual([
      'IMG.jpg',
      '2-img.JPG',
      '3-IMG.jpg',
    ]);
  });
});
