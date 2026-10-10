import { UNSUPPORTED_ATTACHMENT_MESSAGE, type Attachment } from '@tracker/shared';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { fileUpload } from '../helpers/fixtures';
import { jpegPhoto, noisyPixels } from '../helpers/images';
import { useTestServer } from '../helpers/server';

// Reviewer 102 (PT-127 re-review): the declared type comes from the file's name, so a JPEG saved as
// .png arrives as image/png. It was stored as it came with its GPS. Now the bytes decide what the
// file is, what it is stored as, and what it is called; a TIFF, whose EXIF can't be stripped, is
// refused, and an image cut off before its picture is refused rather than kept with its metadata.
describe('an image whose name says another type than its bytes', () => {
  const api = useTestServer('sqlite');

  const upload = (bytes: Uint8Array, name: string, type: string) =>
    api.upload<Attachment & { error?: { message: string } }>(fileUpload({ bytes, name, type }));

  it('is compressed as what it is, and named for what is stored', async () => {
    const photo = await jpegPhoto({ width: 640, height: 480, camera: true });
    const { status, body } = await upload(photo, 'photo.png', 'image/png');
    expect(status).toBe(201);
    expect(body).toMatchObject({ fileName: 'photo.webp', mimeType: 'image/webp', width: 640 });
  });

  it('is kept as what it is when it is lean, under its own type and name', async () => {
    const lean = await jpegPhoto({
      width: 64,
      height: 64,
      pixels: noisyPixels(64, 64),
      quality: 30,
    });
    const { status, body } = await upload(lean, 'shot.gif', 'image/gif');
    expect(status).toBe(201);
    expect(body).toMatchObject({ fileName: 'shot.jpg', mimeType: 'image/jpeg' });
    const stored = [...api.storage.files.entries()].find(([key]) => key.startsWith(body.id));
    expect(stored?.[0]).toBe(`${body.id}.jpg`);
  });

  it('refuses a TIFF, whose metadata can’t be removed', async () => {
    const tiff = new Uint8Array(
      await sharp({ create: { width: 40, height: 30, channels: 3, background: '#2040d0' } })
        .withExif({ IFD0: { Model: 'iPhone 15 Pro' } })
        .tiff()
        .toBuffer(),
    );
    const { status, body } = await upload(tiff, 'scan.jpg', 'image/jpeg');
    expect(status).toBe(400);
    expect(body.error?.message).toBe(UNSUPPORTED_ATTACHMENT_MESSAGE);
    expect(api.storage.files.size).toBe(0);
  });

  it('refuses a JPEG cut off before its picture', async () => {
    const photo = await jpegPhoto({ width: 64, height: 48, camera: true });
    const scan = Buffer.from(photo).indexOf(Buffer.from([0xff, 0xda]));
    const { status, body } = await upload(photo.subarray(0, scan - 10), 'cut.jpg', 'image/jpeg');
    expect(status).toBe(400);
    expect(body.error?.message).toMatch(/cut off|damaged/);
    expect(api.storage.files.size).toBe(0);
  });
});
