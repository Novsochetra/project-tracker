import type { Attachment } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { fileUpload } from '../helpers/fixtures';
import { jpegPhoto } from '../helpers/images';
import { useTestServer } from '../helpers/server';

// Reviewer 102 (PT-127): names are cut to 200 characters from the end, so a long one lost its
// extension, and a photo stored as WebP its .webp: it then downloaded as a file nothing opens.
describe('a name longer than 200 characters', () => {
  const api = useTestServer('sqlite');

  const upload = async (bytes: Uint8Array, name: string, type: string) =>
    (await api.upload<Attachment>(fileUpload({ bytes, name, type }))).body;

  it('is cut before its extension', async () => {
    const file = await upload(new TextEncoder().encode('boom\n'), `${'a'.repeat(300)}.log`, '');
    expect(file.fileName).toHaveLength(200);
    expect(file.fileName).toBe(`${'a'.repeat(196)}.log`);
  });

  it('keeps .webp on a photo stored as WebP', async () => {
    const photo = await jpegPhoto({ width: 64, height: 48, camera: true });
    const file = await upload(photo, `${'IMG '.repeat(80)}.JPG`, 'image/jpeg');
    expect(file.mimeType).toBe('image/webp');
    expect(file.fileName.endsWith('.webp')).toBe(true);
    expect(Array.from(file.fileName)).toHaveLength(200);
  });
});
