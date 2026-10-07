import { describe, expect, it } from 'vitest';
import { describeImage, formatImageList } from '../../src/format/images';
import { authorName, formatBytes, formatTime } from '../../src/format/text';
import { at, attachment } from '../fixtures';

describe('formatBytes', () => {
  it('uses B, KB and MB', () => {
    expect(formatBytes(800)).toBe('800 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(348_160)).toBe('340 KB');
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB');
    expect(formatBytes(1_258_291)).toBe('1.2 MB');
  });
});

describe('formatTime', () => {
  it('prints local date and time as YYYY-MM-DD HH:MM', () => {
    expect(formatTime(at(2, 14, 5))).toBe('2026-10-02 14:05');
    expect(formatTime(at(9, 9))).toBe('2026-10-09 09:00');
  });
});

describe('authorName', () => {
  it('calls the nameless person "User" so agents do not read it as themselves', () => {
    expect(authorName({ kind: 'human', name: '' })).toBe('User');
  });

  it('uses the actor name when there is one', () => {
    expect(authorName({ kind: 'agent', name: ' Claude ' })).toBe('Claude');
    expect(authorName({ kind: 'human', name: 'Sam' })).toBe('Sam');
  });

  it('falls back to "Agent" for a nameless agent', () => {
    expect(authorName({ kind: 'agent', name: '' })).toBe('Agent');
  });
});

describe('image descriptions', () => {
  it('shows name, size and dimensions', () => {
    expect(describeImage(attachment())).toBe('screenshot.png · 1 KB · 1170×2532');
  });

  it('leaves out unknown dimensions', () => {
    expect(describeImage(attachment({ width: null, height: null, size: 900 }))).toBe(
      'screenshot.png · 900 B',
    );
  });

  it('lists images as bullet lines', () => {
    const images = [
      attachment(),
      attachment({ fileName: 'b.gif', size: 2048, width: 10, height: 20 }),
    ];
    expect(formatImageList(images)).toEqual([
      '- screenshot.png · 1 KB · 1170×2532',
      '- b.gif · 2 KB · 10×20',
    ]);
  });
});
