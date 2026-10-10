import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { UNSUPPORTED_ATTACHMENT_MESSAGE, formatBytes } from '@tracker/shared';
import SQLite from 'better-sqlite3';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  moveData,
  openMoveTarget,
  tableCounts,
  writeMoveSource,
  type MoveSource,
} from '../helpers/dataMove';
import { startFakeS3, type FakeS3 } from '../helpers/fakeS3';
import { containsText, jpegPhoto, noisyPixels } from '../helpers/images';
import { DIALECTS } from '../helpers/server';

let fake: FakeS3;

beforeAll(async () => {
  fake = await startFakeS3();
});

afterAll(async () => {
  await fake.close();
});

interface ExtraFile {
  id: string;
  name: string;
  type: string;
  bytes: Uint8Array;
  // The comment it is on, else the ticket's own files.
  activityId?: string;
}

// Files a local tracker could hold from before uploads were typed by their bytes.
async function addFiles(source: MoveSource, files: readonly ExtraFile[]): Promise<void> {
  const db = new SQLite(source.file);
  try {
    const insert = db.prepare(
      `insert into attachments (id, ticket_id, activity_id, file_name, mime_type, size, width,
        height, storage_key, created_at) values (?, 't1', ?, ?, ?, ?, null, null, ?, 2000)`,
    );
    for (const file of files) {
      const key = `${file.id}.${file.name.split('.').pop()}`;
      insert.run(
        file.id,
        file.activityId ?? null,
        file.name,
        file.type,
        file.bytes.byteLength,
        key,
      );
      await writeFile(join(source.uploads, key), file.bytes);
    }
  } finally {
    db.close();
  }
}

const tiffScan = async () =>
  new Uint8Array(
    await sharp({ create: { width: 40, height: 30, channels: 3, background: '#2040d0' } })
      .withExif({ IFD0: { Model: 'iPhone 15 Pro' } })
      .tiff()
      .toBuffer(),
  );

async function cutPhoto(): Promise<Uint8Array> {
  const photo = await jpegPhoto({ width: 64, height: 48, camera: true });
  return photo.subarray(0, Buffer.from(photo).indexOf(Buffer.from([0xff, 0xda])) - 10);
}

async function unstorableSource(): Promise<{ source: MoveSource; scan: Uint8Array }> {
  const source = await writeMoveSource();
  const scan = await tiffScan();
  await addFiles(source, [
    { id: 'f-scan', name: 'scan.jpg', type: 'image/jpeg', bytes: scan },
    { id: 'f-cut', name: 'cut.jpg', type: 'image/jpeg', bytes: await cutPhoto(), activityId: 'a2' },
  ]);
  return { source, scan };
}

const NOT_WHOLE = /cut off or damaged before its picture/;

// compressImage now refuses a TIFF and an image cut off before its picture, handing back the
// original bytes: their metadata (a photo's place, the camera) can't be removed. The move took the
// bytes it was given and stored them online as they were, metadata and all.
describe.each(DIALECTS)('a source with images that can’t be stored (%s)', (dialect) => {
  it('is listed by a dry run: id, ticket, name, size and reason, no ticket text', async () => {
    const { source, scan } = await unstorableSource();
    const target = await openMoveTarget(dialect, fake);

    const { ok, lines } = await moveData(source, target, { dryRun: true });

    expect(ok).toBe(false);
    expect(lines).toContain(
      "  2 image(s) can't go online as they are: their metadata (such as where a photo was " +
        'taken) can’t be removed. In the local tracker, remove each one listed with only a ticket ' +
        'key from that ticket’s files. A file on a comment, report or review can’t be removed ' +
        'alone: delete that comment, report or review instead (copy its text first if you want ' +
        'to post it again as a comment, with a copy of the image saved again). Then run the move ' +
        'again:',
    );
    expect(lines).toContain(
      `    - f-scan (MOB-1, scan.jpg, ${formatBytes(scan.byteLength)}): ${UNSUPPORTED_ATTACHMENT_MESSAGE}`,
    );
    expect(lines.find((line) => line.startsWith('    - f-cut'))).toMatch(
      /^ {4}- f-cut \(a comment on MOB-1, cut\.jpg, \d+ K?B\): .*cut off or damaged/,
    );
    expect(lines.join('\n')).not.toMatch(/Crash on launch|See photo\.jpg|Logs attached/);
    expect(fake.calls).toEqual([]);
    expect(await target.db.introspection.getTables()).toEqual([]);
  });

  it('stops a real run before any file or row is written', async () => {
    const { source } = await unstorableSource();
    const target = await openMoveTarget(dialect, fake);

    const { ok, lines } = await moveData(source, target);

    expect(ok).toBe(false);
    expect(lines).toContain('Nothing was moved:');
    expect(lines.some((line) => line.startsWith('    - f-scan (MOB-1'))).toBe(true);
    expect(lines.some((line) => NOT_WHOLE.test(line) && line.includes('f-cut'))).toBe(true);
    expect(fake.objects.size).toBe(0);
    expect(await target.db.introspection.getTables()).toEqual([]);
  });

  it('stores an image as what its bytes are, whatever its old type said', async () => {
    const source = await writeMoveSource();
    const lean = await jpegPhoto({
      width: 64,
      height: 64,
      pixels: noisyPixels(64, 64),
      quality: 30,
    });
    await addFiles(source, [
      {
        id: 'f-named-png',
        name: 'holiday.png',
        type: 'image/png',
        bytes: await jpegPhoto({ width: 640, height: 480, camera: true }),
      },
      { id: 'f-lean-png', name: 'lean.png', type: 'image/png', bytes: lean },
    ]);
    const target = await openMoveTarget(dialect, fake);

    expect((await moveData(source, target)).ok).toBe(true);

    const rows = await target.db
      .selectFrom('attachments')
      .select(['id', 'fileName', 'mimeType', 'storageKey', 'size'])
      .where('id', 'in', ['f-named-png', 'f-lean-png'])
      .orderBy('id')
      .execute();
    const stored = await target.stored();
    expect(rows).toEqual([
      {
        id: 'f-lean-png',
        fileName: 'lean.jpg',
        mimeType: 'image/jpeg',
        storageKey: 'f-lean-png.jpg',
        size: stored.get('f-lean-png.jpg')?.byteLength,
      },
      {
        id: 'f-named-png',
        fileName: 'holiday.webp',
        mimeType: 'image/webp',
        storageKey: 'f-named-png.webp',
        size: stored.get('f-named-png.webp')?.byteLength,
      },
    ]);
    expect(containsText(stored.get('f-named-png.webp')!, 'iPhone 15 Pro')).toBe(false);
    expect(stored.get('f-lean-png.jpg')!.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
    expect(await tableCounts(target.db)).toMatchObject({ attachments: 5 });
  });
});
