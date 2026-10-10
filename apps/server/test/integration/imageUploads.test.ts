import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MAX_PHOTO_PIXELS, type Attachment } from '@tracker/shared';
import type { Hono } from 'hono';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import type { Db } from '../../src/db/schema';
import { createBroadcaster } from '../../src/events/broadcaster';
import type { AppEnv } from '../../src/http/env';
import { createDiskStorage } from '../../src/storage/diskStorage';
import type { FileStorage } from '../../src/storage/fileStorage';
import { createS3Storage } from '../../src/storage/s3Storage';
import { startFakeS3 } from '../helpers/fakeS3';
import { fileUpload } from '../helpers/fixtures';
import {
  containsText,
  jpegPhoto,
  pngImage,
  rawImage,
  screenPixels,
  twoColorPixels,
} from '../helpers/images';
import { createTestDatabase } from '../helpers/server';

interface StorageUnderTest {
  storage: FileStorage;
  close: () => Promise<void>;
}

function disk(): Promise<StorageUnderTest> {
  const dir = mkdtempSync(join(tmpdir(), 'tracker-images-'));
  return Promise.resolve({
    storage: createDiskStorage(dir),
    close: () => Promise.resolve(rmSync(dir, { recursive: true, force: true })),
  });
}

async function s3(): Promise<StorageUnderTest> {
  const fake = await startFakeS3();
  return {
    storage: createS3Storage({ client: fake.client(), bucket: fake.bucket }),
    close: () => fake.close(),
  };
}

const STORAGES: [string, () => Promise<StorageUnderTest>][] = [
  ['disk', disk],
  ['s3', s3],
];

const bytesOf = async (stream: Promise<ReadableStream<Uint8Array> | null>) =>
  new Uint8Array(await new Response(await stream).arrayBuffer());

// PT-127: images are stored compressed, upright and without their metadata, in place of the
// original, on disk and in S3 alike.
describe.each(STORAGES)('image uploads stored on %s', (_kind, open) => {
  let subject: StorageUnderTest;
  let db: Db;
  let app: Hono<AppEnv>;

  beforeAll(async () => {
    subject = await open();
    db = await createTestDatabase('sqlite');
    app = createApp({ db, storage: subject.storage, events: createBroadcaster() });
  });

  afterAll(async () => {
    await db.destroy();
    await subject.close();
  });

  async function upload(bytes: Uint8Array, name: string, type: string): Promise<Attachment> {
    const { path, init } = fileUpload({ bytes, name, type });
    const res = await app.request(path, init);
    expect(res.status).toBe(201);
    return (await res.json()) as Attachment;
  }

  it('stores a phone photo upright, smaller, as WebP and without its location', async () => {
    const photo = await jpegPhoto({
      width: 3000,
      height: 2000,
      pixels: twoColorPixels(3000, 2000),
      orientation: 6,
      camera: true,
    });
    const file = await upload(photo, 'IMG_0042.JPG', 'image/jpeg');
    expect(file).toMatchObject({ fileName: 'IMG_0042.webp', mimeType: 'image/webp' });
    expect(file.height).toBeGreaterThan(file.width!);
    expect(file.width! * file.height!).toBeLessThanOrEqual(MAX_PHOTO_PIXELS);

    expect(await subject.storage.stat(`${file.id}.jpg`)).toBeNull();
    const stored = await bytesOf(subject.storage.read(`${file.id}.webp`));
    expect(stored.byteLength).toBe(file.size);
    expect(file.size).toBeLessThan(photo.byteLength);
    expect(containsText(stored, 'iPhone 15 Pro')).toBe(false);
    expect(await sharp(stored).metadata()).toMatchObject({
      format: 'webp',
      width: file.width,
      height: file.height,
    });

    const res = await app.request(file.url);
    expect(res.headers.get('content-type')).toBe('image/webp');
    expect(res.headers.get('content-disposition')).toContain('filename="IMG_0042.webp"');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(stored);
  });

  it('stores a screenshot as lossless WebP at full size', async () => {
    const shot = await pngImage(screenPixels(1170, 2532), 1170, 2532, 1);
    const file = await upload(shot, 'Screenshot 2026-10-09.png', 'image/png');
    expect(file).toMatchObject({
      fileName: 'Screenshot 2026-10-09.webp',
      mimeType: 'image/webp',
      width: 1170,
      height: 2532,
    });
    expect(file.size).toBeLessThan(shot.byteLength / 2);
  });

  it('keeps a GIF as it came', async () => {
    const gif = new Uint8Array(await rawImage(screenPixels(40, 30), 40, 30).gif().toBuffer());
    const file = await upload(gif, 'spinner.gif', 'image/gif');
    expect(file).toMatchObject({ fileName: 'spinner.gif', mimeType: 'image/gif', width: 40 });
    expect(await bytesOf(subject.storage.read(`${file.id}.gif`))).toEqual(gif);
  });
});
