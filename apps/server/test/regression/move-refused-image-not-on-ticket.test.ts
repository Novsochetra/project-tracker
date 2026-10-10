import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import SQLite from 'better-sqlite3';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { moveData, openMoveTarget, writeMoveSource, type MoveSource } from '../helpers/dataMove';

async function addScan(source: MoveSource, id: string, ticketId: string | null): Promise<void> {
  const tiff = await sharp({
    create: { width: 40, height: 30, channels: 3, background: '#2040d0' },
  })
    .tiff()
    .toBuffer();
  const db = new SQLite(source.file);
  try {
    db.prepare(
      `insert into attachments (id, ticket_id, activity_id, file_name, mime_type, size, width,
        height, storage_key, created_at) values (?, ?, null, 'scan.jpg', 'image/jpeg', ?, null,
        null, ?, 2000)`,
    ).run(id, ticketId, tiff.byteLength, `${id}.jpg`);
  } finally {
    db.close();
  }
  await writeFile(join(source.uploads, `${id}.jpg`), tiff);
}

// Reviewer 114 (PT-124): the refusal said to delete each image it lists in the local tracker, but
// it also listed images "not on a ticket yet", which the app has no place to delete from.
describe('a move refusing images it can’t store', () => {
  it('lists only images on a ticket or comment, and says to delete them from there', async () => {
    const source = await writeMoveSource();
    await addScan(source, 'f-on-ticket', 't1');
    await addScan(source, 'f-pending', null);
    const target = await openMoveTarget('sqlite', null);

    const { ok, lines } = await moveData(source, target, { dryRun: true });

    expect(ok).toBe(false);
    expect(lines).toContain(
      "  1 image(s) can't go online as they are: their metadata (such as where a photo was " +
        'taken) can’t be removed. In the local tracker, delete each from the ticket or comment ' +
        'named below (and attach a copy saved again if you need it), then run the move again:',
    );
    expect(lines.some((line) => line.startsWith('    - f-on-ticket (MOB-1, scan.jpg'))).toBe(true);
    expect(lines.join('\n')).not.toMatch(/f-pending|not on a ticket yet/);
    expect(lines.some((line) => line.startsWith('Not copied: 1 upload(s) on no ticket'))).toBe(
      true,
    );
  });
});
