import { UNSUPPORTED_ATTACHMENT_MESSAGE } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { admitFiles, carriesFiles, filesOf, roomFor } from './attachmentFiles';

const MB = 1024 * 1024;

const file = (name: string, type: string) => new File(['x'], name, { type });

function sized(name: string, type: string, size: number): File {
  const big = file(name, type);
  Object.defineProperty(big, 'size', { value: size });
  return big;
}

function transfer(files: File[], options: { asItems?: boolean; types?: string[] } = {}) {
  const items = files.map((item) => ({ kind: 'file', getAsFile: () => item }));
  return {
    files: options.asItems ? [] : files,
    items: [...items, { kind: 'string', getAsFile: () => null }],
    types: options.types ?? ['Files'],
  } as unknown as DataTransfer;
}

describe('admitFiles', () => {
  it('admits every kind the tracker stores, with its kind', () => {
    const files = [
      file('shot.png', 'image/png'),
      file('clip.mov', 'video/quicktime'),
      file('notes.md', ''),
      file('spec.pdf', 'application/pdf'),
    ];
    const { admitted, refused } = admitFiles(files);
    expect(admitted.map((entry) => [entry.file, entry.kind])).toEqual([
      [files[0], 'image'],
      [files[1], 'video'],
      [files[2], 'text'],
      [files[3], 'pdf'],
    ]);
    expect(refused).toEqual([]);
  });

  it('keeps the rest and says why each refused file cannot be attached', () => {
    const shot = file('shot.png', 'image/png');
    const { admitted, refused } = admitFiles([
      file('vector.svg', 'image/svg+xml'),
      shot,
      sized('long.mp4', 'video/mp4', 100 * MB + 1),
    ]);
    expect(admitted.map((entry) => entry.file)).toEqual([shot]);
    expect(refused).toEqual([
      { name: 'vector.svg', reason: UNSUPPORTED_ATTACHMENT_MESSAGE },
      { name: 'long.mp4', reason: 'Videos can be up to 100 MB.' },
    ]);
  });

  it('refuses a file over the limit of its kind', () => {
    expect(admitFiles([sized('huge.log', '', 5 * MB + 1)]).refused).toEqual([
      { name: 'huge.log', reason: 'Text files can be up to 5 MB.' },
    ]);
  });

  it('admits a large photo, which is scaled down before it goes', () => {
    const photo = sized('IMG_0001.HEIC', 'image/heic', 20 * MB);
    expect(admitFiles([photo]).admitted.map((entry) => entry.file)).toEqual([photo]);
  });

  it('admits only as many as there is room for, in the order picked', () => {
    const files = ['a.txt', 'b.svg', 'c.txt', 'd.txt'].map((name) =>
      file(name, name.endsWith('.svg') ? 'image/svg+xml' : 'text/plain'),
    );
    const { admitted, refused } = admitFiles(files, { room: 2, reason: 'Full.' });
    expect(admitted.map((entry) => entry.file.name)).toEqual(['a.txt', 'c.txt']);
    expect(refused).toEqual([
      { name: 'b.svg', reason: UNSUPPORTED_ATTACHMENT_MESSAGE },
      { name: 'd.txt', reason: 'Full.' },
    ]);
  });

  it('names a file without a name', () => {
    expect(admitFiles([file('', 'image/svg+xml')]).refused[0]?.name).toBe('A file');
  });
});

describe('roomFor', () => {
  it('leaves a new ticket or comment room for 20 files in all', () => {
    expect(roomFor({ owner: 'ticket', attached: 15 }, 3)).toEqual({
      room: 2,
      reason: 'A new ticket can have up to 20 files.',
    });
    expect(roomFor({ owner: 'comment', attached: 20 }, 0)).toEqual({
      room: 0,
      reason: 'A comment can have up to 20 files.',
    });
  });

  it('has no limit for a ticket that exists', () => {
    expect(roomFor(undefined, 50).room).toBe(Infinity);
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
