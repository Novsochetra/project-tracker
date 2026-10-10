import type { Attachment } from '@tracker/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app';
import type { Db } from '../../src/db/schema';
import { createBroadcaster } from '../../src/events/broadcaster';
import { deleteAllRows } from '../../src/repositories/reset';
import { PENDING_TTL_MS, removeStalePendingAttachments } from '../../src/services/attachments';
import type { FileStorage } from '../../src/storage/fileStorage';
import { createS3Storage } from '../../src/storage/s3Storage';
import { startFakeS3, type FakeS3 } from '../helpers/fakeS3';
import { fileUpload } from '../helpers/fixtures';
import { clientFor, createTestDatabase } from '../helpers/server';

// Reviewer 102 (PT-122): when S3 refused DeleteObject, a delete answered 500 although the row was
// gone, and the same failure at start stopped the server. Now the answer says what happened to the
// attachment, and the log names what S3 kept, for a person to remove (no server guesses from a
// listing which files are whose: PT-133).
describe('S3 refusing to delete an object', () => {
  let fake: FakeS3;
  let db: Db;
  let storage: FileStorage;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    fake = await startFakeS3();
    db = await createTestDatabase('sqlite');
    storage = createS3Storage({ client: fake.client(), bucket: fake.bucket });
    app = createApp({ db, storage, events: createBroadcaster() });
  });

  beforeEach(async () => {
    await deleteAllRows(db);
    fake.reset();
  });

  afterAll(async () => {
    await db.destroy();
    await fake.close();
  });

  const upload = async () => {
    const { path, init } = fileUpload({ name: 'notes.txt' });
    return (await (await app.request(path, init)).json()) as Attachment;
  };
  const rows = async () => (await db.selectFrom('attachments').select('id').execute()).length;
  const quietly = () => vi.spyOn(console, 'warn').mockImplementation(() => undefined);

  it('still deletes the attachment, and names the object S3 kept', async () => {
    const file = await upload();
    fake.refused.add('DeleteObject');
    const warned = quietly();
    const res = await app.request(`/api/attachments/${file.id}`, { method: 'DELETE' });
    const logged = warned.mock.calls.flat().join(' ');
    warned.mockRestore();
    expect(res.status).toBe(204);
    expect(await rows()).toBe(0);
    expect(logged).toContain(`${file.id}.txt`);
    expect([...fake.objects.keys()]).toEqual([`attachments/${file.id}.txt`]);
  });

  it('still deletes a ticket with files', async () => {
    const client = clientFor(app);
    await client.createProject({ name: 'Mobile app', key: 'MA' });
    await client.createTicket('MA', { title: 'Crash' });
    const { path, init } = fileUpload({ name: 'crash.log', ticketKey: 'MA-1' });
    expect((await app.request(path, init)).status).toBe(201);
    fake.refused.add('DeleteObject');
    const warned = quietly();
    await client.deleteTicket('MA-1');
    warned.mockRestore();
    expect(await rows()).toBe(0);
    expect(fake.objects.size).toBe(1);
  });

  it('lets the start-up clean-up of old pending uploads finish', async () => {
    await upload();
    fake.refused.add('DeleteObject');
    const warned = quietly();
    const later = Date.now() + PENDING_TTL_MS + 1000;
    await expect(removeStalePendingAttachments({ db, storage }, later)).resolves.toBe(1);
    warned.mockRestore();
    expect(await rows()).toBe(0);
  });
});
