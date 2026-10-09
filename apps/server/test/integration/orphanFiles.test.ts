import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Attachment } from '@tracker/shared';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app';
import type { Db } from '../../src/db/schema';
import { createBroadcaster } from '../../src/events/broadcaster';
import { ORPHAN_AGE_MS, removeOrphanFiles } from '../../src/services/orphanFiles';
import { createDiskStorage } from '../../src/storage/diskStorage';
import { createS3Storage } from '../../src/storage/s3Storage';
import { startFakeS3, type FakeS3 } from '../helpers/fakeS3';
import { fileUpload } from '../helpers/fixtures';
import { createTestDatabase } from '../helpers/server';

const HOUR_AGO = () => Date.now() - ORPHAN_AGE_MS - 60_000;

// Files no attachment names: left by a delete S3 refused, or an upload cut off between storing its
// file and its row. Removed once they are old enough that no upload can still be on its way.
describe('removeOrphanFiles', () => {
  let db: Db;
  let fake: FakeS3;
  const dir = mkdtempSync(join(tmpdir(), 'tracker-orphans-'));

  beforeAll(async () => {
    db = await createTestDatabase('sqlite');
    fake = await startFakeS3();
  });

  afterAll(async () => {
    await db.destroy();
    await fake.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('removes old files on disk no attachment names, and keeps the rest', async () => {
    const storage = createDiskStorage(dir);
    const app = createApp({ db, storage, events: createBroadcaster() });
    const { path, init } = fileUpload({ name: 'kept.txt' });
    const kept = (await (await app.request(path, init)).json()) as Attachment;
    for (const name of ['old-orphan.txt', 'new-orphan.txt', '.partial-upload']) {
      writeFileSync(join(dir, name), 'x');
    }
    const old = HOUR_AGO() / 1000;
    utimesSync(join(dir, 'old-orphan.txt'), old, old);
    utimesSync(join(dir, `${kept.id}.txt`), old, old);

    expect(await removeOrphanFiles({ db, storage }, Date.now())).toBe(1);
    expect(await storage.stat('old-orphan.txt')).toBeNull();
    expect(await storage.stat('new-orphan.txt')).not.toBeNull();
    expect(await storage.stat(`${kept.id}.txt`)).not.toBeNull();
  });

  it('removes old objects in S3 no attachment names, over several pages', async () => {
    const storage = createS3Storage({ client: fake.client(), bucket: fake.bucket });
    for (const name of ['a', 'b', 'c', 'd', 'e']) {
      fake.objects.set(`attachments/${name}.png`, Buffer.from('x'));
      fake.modified.set(`attachments/${name}.png`, name === 'e' ? Date.now() : HOUR_AGO());
    }
    fake.objects.set('elsewhere/f.png', Buffer.from('x'));
    expect(await removeOrphanFiles({ db, storage }, Date.now())).toBe(4);
    expect([...fake.objects.keys()].sort()).toEqual(['attachments/e.png', 'elsewhere/f.png']);
  });

  it('says why when S3 won’t list the bucket, without stopping', async () => {
    const storage = createS3Storage({ client: fake.client(), bucket: fake.bucket });
    fake.refused.add('ListObjectsV2');
    const error = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expect(removeOrphanFiles({ db, storage }, Date.now())).rejects.toThrow(
      /ListObjectsV2.*AccessDenied/,
    );
    error.mockRestore();
    fake.refused.clear();
  });
});
