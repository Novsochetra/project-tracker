import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import SQLite from 'better-sqlite3';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { moveData, openMoveTarget, writeMoveSource, type MoveSource } from '../helpers/dataMove';

async function addScan(source: MoveSource, id: string, ticketId: string, activityId: string) {
  const tiff = await sharp({
    create: { width: 40, height: 30, channels: 3, background: '#2040d0' },
  })
    .tiff()
    .toBuffer();
  const db = new SQLite(source.file);
  try {
    db.prepare(
      `insert into attachments (id, ticket_id, activity_id, file_name, mime_type, size, width,
        height, storage_key, created_at) values (?, ?, ?, 'scan.jpg', 'image/jpeg', ?, null,
        null, ?, 2000)`,
    ).run(id, ticketId, activityId, tiff.byteLength, `${id}.jpg`);
  } finally {
    db.close();
  }
  await writeFile(join(source.uploads, `${id}.jpg`), tiff);
}

// Reviewer 123 (PT-144): the refusal said to delete each image "from the ticket or comment named
// below", but the app can't remove one file from a comment, report or review (no remove control,
// PATCH /activity/:id takes only text): only deleting that whole item gets rid of it.
describe('a move refusing an image on a comment or review', () => {
  it('names the item that holds it and says to delete that item', async () => {
    const source = await writeMoveSource();
    await addScan(source, 'f-comment-scan', 't1', 'a2');
    await addScan(source, 'f-review-scan', 't3', 'a3');
    const target = await openMoveTarget('sqlite', null);

    const { ok, lines } = await moveData(source, target, { dryRun: true });

    expect(ok).toBe(false);
    expect(
      lines.some((l) => l.startsWith('    - f-comment-scan (a comment on MOB-1, scan.jpg')),
    ).toBe(true);
    expect(
      lines.some((l) => l.startsWith('    - f-review-scan (a review on MOB-3, scan.jpg')),
    ).toBe(true);
    const refusal = lines.find((l) => l.includes("can't go online as they are")) ?? '';
    expect(refusal).toMatch(/delete that comment instead/);
    expect(refusal).not.toMatch(/delete each from the ticket or comment/);
  });
});
