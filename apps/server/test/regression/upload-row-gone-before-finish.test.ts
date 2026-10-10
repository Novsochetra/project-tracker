import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app';
import { createBroadcaster } from '../../src/events/broadcaster';
import { deleteAllRows } from '../../src/repositories/reset';
import type { FileStorage } from '../../src/storage/fileStorage';
import { createMemoryStorage } from '../../src/storage/memoryStorage';
import { fileUpload } from '../helpers/fixtures';
import { createTestDatabase, DIALECTS } from '../helpers/server';

// Reviewer 116 (PT-133): finishAttachmentRow updates by id and ignores a row that is gone, so an
// upload whose pending row was removed while its file was written answers 201 for an attachment
// that doesn't exist, and its file stays with no row naming it.
describe.each(DIALECTS)('an upload whose pending row goes before it finishes (%s)', (dialect) => {
  it('does not answer as stored, and keeps no file', async () => {
    const db = await createTestDatabase(dialect);
    const memory = createMemoryStorage();
    let release!: () => void;
    let reached = false;
    const held: FileStorage = {
      ...memory,
      async write(key, body) {
        await memory.write(key, body);
        reached = true;
        await new Promise<void>((resolve) => (release = resolve));
      },
    };
    const app = createApp({ db, storage: held, events: createBroadcaster() });
    const { path, init } = fileUpload({ name: 'notes.txt' });
    const answer = app.request(path, init);
    while (!reached) await new Promise((r) => setTimeout(r, 5));
    await deleteAllRows(db);
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    release();
    const res = await answer;
    logged.mockRestore();
    const rows = await db.selectFrom('attachments').select('id').execute();
    await db.destroy();
    expect({ status: res.status, rows: rows.length, files: memory.files.size }).toEqual({
      status: 500,
      rows: 0,
      files: 0,
    });
  });
});
