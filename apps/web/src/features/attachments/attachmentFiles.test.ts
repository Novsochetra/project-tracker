import { UNSUPPORTED_ATTACHMENT_MESSAGE } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { admitFiles, carriesFiles, filesOf } from './attachmentFiles';

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
    const { admitted, refusal } = admitFiles(files);
    expect(admitted.map((entry) => [entry.file, entry.kind])).toEqual([
      [files[0], 'image'],
      [files[1], 'video'],
      [files[2], 'text'],
      [files[3], 'pdf'],
    ]);
    expect(refusal).toBeNull();
  });

  it('keeps the rest and says why the first refused file cannot be attached', () => {
    const shot = file('shot.png', 'image/png');
    const { admitted, refusal } = admitFiles([
      file('vector.svg', 'image/svg+xml'),
      shot,
      sized('long.mp4', 'video/mp4', 100 * MB + 1),
    ]);
    expect(admitted.map((entry) => entry.file)).toEqual([shot]);
    expect(refusal).toBe(UNSUPPORTED_ATTACHMENT_MESSAGE);
  });

  it('refuses a file over the limit of its kind', () => {
    expect(admitFiles([sized('long.mp4', 'video/mp4', 100 * MB + 1)]).refusal).toBe(
      'Videos can be up to 100 MB.',
    );
    expect(admitFiles([sized('huge.log', '', 5 * MB + 1)]).refusal).toBe(
      'Text files can be up to 5 MB.',
    );
  });

  it('admits a large photo, which is scaled down before it goes', () => {
    const photo = sized('IMG_0001.HEIC', 'image/heic', 20 * MB);
    expect(admitFiles([photo]).admitted.map((entry) => entry.file)).toEqual([photo]);
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
