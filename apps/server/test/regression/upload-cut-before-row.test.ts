import type { Attachment } from '@tracker/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import type { Db } from '../../src/db/schema';
import { createBroadcaster } from '../../src/events/broadcaster';
import { PENDING_TTL_MS, removeStalePendingAttachments } from '../../src/services/attachments';
import type { FileStorage } from '../../src/storage/fileStorage';
import { createMemoryStorage } from '../../src/storage/memoryStorage';
import { fileUpload } from '../helpers/fixtures';
import { clientFor, createTestDatabase } from '../helpers/server';

// PT-133: a file was stored first and its row after it, so a server stopped in between left a file
// no row named, which only a listing could find, and a listing can't tell this database's files
// from another's. The row now goes in first, pending, and the pending clean-up finds the file.
describe('an upload whose server stops after its file is stored', () => {
  let db: Db;
  const memory = createMemoryStorage();
  // Stores the file, then never answers, as if the process had stopped there.
  const stopped: FileStorage = {
    ...memory,
    async write(key, body) {
      await memory.write(key, body);
      await new Promise(() => undefined);
    },
  };

  beforeAll(async () => {
    db = await createTestDatabase('sqlite');
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('leaves a pending row naming its file, which the clean-up removes with it', async () => {
    const app = createApp({ db, storage: stopped, events: createBroadcaster() });
    const { path, init } = fileUpload({ name: 'notes.txt' });
    void app.request(path, init);
    while (memory.files.size === 0) await new Promise((resolve) => setTimeout(resolve, 5));

    const rows = await db.selectFrom('attachments').selectAll().execute();
    expect(rows).toMatchObject([{ ticketId: null, activityId: null }]);
    expect([...memory.files.keys()]).toEqual([rows[0]!.storageKey]);

    const later = Date.now() + PENDING_TTL_MS + 1000;
    await removeStalePendingAttachments({ db, storage: memory }, later);
    expect(await db.selectFrom('attachments').select('id').execute()).toEqual([]);
    expect(memory.files.size).toBe(0);
  });

  it('is not shown on its ticket until its file is whole', async () => {
    const app = createApp({ db, storage: stopped, events: createBroadcaster() });
    const client = clientFor(app);
    await client.createProject({ name: 'Mobile app', key: 'MA' });
    await client.createTicket('MA', { title: 'Crash' });
    const { path, init } = fileUpload({ name: 'crash.log', ticketKey: 'MA-1' });
    void app.request(path, init);
    const before = memory.files.size;
    while (memory.files.size === before) await new Promise((resolve) => setTimeout(resolve, 5));
    const attachments: Attachment[] = (await client.getTicket('MA-1')).attachments;
    expect(attachments).toEqual([]);
  });
});
