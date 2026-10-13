import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { createDatabase } from '../../src/db/createDatabase';
import { migrateToLatest } from '../../src/db/migrator';
import { createBroadcaster } from '../../src/events/broadcaster';
import { createDiskStorage } from '../../src/storage/diskStorage';
import type { FileStorage } from '../../src/storage/fileStorage';
import {
  moveData,
  openMoveTarget,
  SOURCE_COUNTS,
  tableCounts,
  writeMoveSource,
} from '../helpers/dataMove';
import { fileUpload } from '../helpers/fixtures';
import { DIALECTS } from '../helpers/server';

// Reviewer 116 (PT-133): an upload's row now goes in first, pending with size 0. A local server
// killed mid-upload (crash, kill -9, power loss) leaves that row until a start a day later. The
// data move copies every attachment row and refuses a row whose file is missing or of another
// size, so a crash during an upload blocks moving the tracker online for a day.
async function sourceWithCutUpload(writeWhole: boolean) {
  const source = await writeMoveSource();
  const db = createDatabase(source.file);
  await migrateToLatest(db);
  const disk = createDiskStorage(source.uploads);
  let reached = false;
  const stopped: FileStorage = {
    ...disk,
    async write(key, body) {
      if (writeWhole) await disk.write(key, body);
      reached = true;
      await new Promise(() => undefined);
    },
  };
  const app = createApp({ db, storage: stopped, events: createBroadcaster() });
  const { path, init } = fileUpload({ name: 'crash.log', ticketKey: 'MOB-1' });
  void app.request(path, init);
  while (!reached) await new Promise((r) => setTimeout(r, 5));
  await db.destroy();
  return source;
}

async function sourceWithPendingUpload() {
  const source = await writeMoveSource();
  const db = createDatabase(source.file);
  await migrateToLatest(db);
  const storage = createDiskStorage(source.uploads);
  const app = createApp({ db, storage, events: createBroadcaster() });
  const { path, init } = fileUpload({ name: 'picked.txt' });
  const { id } = (await (await app.request(path, init)).json()) as { id: string };
  await db.destroy();
  return { source, id };
}

const LEFT_OUT =
  'Not copied: 1 upload(s) on no ticket or comment yet (files picked for a ticket or comment ' +
  'not created yet, or an upload cut off when the tracker stopped).';

describe.each(DIALECTS)(
  'moving into %s a tracker whose server stopped during an upload',
  (dialect) => {
    it('is not refused for the cut upload that never reached its ticket (file not written)', async () => {
      const source = await sourceWithCutUpload(false);
      const target = await openMoveTarget(dialect, null);
      const { ok, lines } = await moveData(source, target);
      expect(lines.join('\n')).not.toContain('are not in');
      expect(ok).toBe(true);
      expect(lines).toContain(LEFT_OUT);
      expect(await tableCounts(target.db)).toEqual(SOURCE_COUNTS);
    });

    it('is not refused for the cut upload that never reached its ticket (file written)', async () => {
      const source = await sourceWithCutUpload(true);
      const target = await openMoveTarget(dialect, null);
      const { ok, lines } = await moveData(source, target);
      expect(lines.join('\n')).not.toContain('differ in size');
      expect(ok).toBe(true);
      expect(lines).toContain(LEFT_OUT);
      expect(await tableCounts(target.db)).toEqual(SOURCE_COUNTS);
    });

    it('leaves out a whole upload on no ticket or comment yet, and says so', async () => {
      const { source, id } = await sourceWithPendingUpload();
      const target = await openMoveTarget(dialect, null);
      const { ok, lines } = await moveData(source, target);
      expect(ok).toBe(true);
      expect(lines).toContain('  attachments    3');
      expect(lines).toContain(LEFT_OUT);
      expect(await tableCounts(target.db)).toEqual(SOURCE_COUNTS);
      expect([...(await target.stored()).keys()].filter((key) => key.startsWith(id))).toEqual([]);
    });
  },
);
