import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import SQLite from 'better-sqlite3';
import { sql } from 'kysely';
import { onTestFinished } from 'vitest';
import { runMove, type MoveOptions } from '../../src/dataMove/runMove';
import { createDatabase } from '../../src/db/createDatabase';
import { createMigrator } from '../../src/db/migrator';
import type { Db } from '../../src/db/schema';
import { createDiskStorage } from '../../src/storage/diskStorage';
import type { FileStorage } from '../../src/storage/fileStorage';
import { createS3Storage, S3_KEY_PREFIX } from '../../src/storage/s3Storage';
import type { FakeS3 } from './fakeS3';
import { pngBytes } from './fixtures';
import { jpegPhoto } from './images';
import { openEmptyDatabase, type TestDialect } from './server';

export interface MoveSource {
  dir: string;
  file: string;
  uploads: string;
  photo: Uint8Array;
  notes: Uint8Array;
  tiny: Uint8Array;
}

export const SOURCE_COUNTS = {
  projects: 1,
  statuses: 2,
  tickets: 2,
  activities: 3,
  attachments: 3,
} as const;

// Only columns every schema since 0001_initial has, so a source can be as old as that.
async function insertRows(db: Db, files: Pick<MoveSource, 'photo' | 'notes' | 'tiny'>) {
  const raw = db.withoutPlugins();
  await sql`insert into projects (id, name, key, description, repo, color, next_num, created_at,
    updated_at) values ('p1', 'Mobile app', 'MOB', 'Phone app', '/code/mobile', '#5B5BD6', 4,
    1000, 5000)`.execute(raw);
  await sql`insert into statuses (id, project_id, name, category, color, position, created_at)
    values ('s-todo', 'p1', 'To do', 'todo', '#8B8D98', 0, 1000),
      ('s-done', 'p1', 'Done', 'done', '#30A46C', 1, 1001)`.execute(raw);
  await sql`insert into tickets (id, project_id, num, status_id, rank, title, description,
    priority, assignee, due, created_at, updated_at) values
      ('t1', 'p1', 1, 's-todo', 0, 'Crash on launch', 'See photo.jpg and f-photo.jpg.', 'high',
        'Claude', '2026-11-01', 1100, 4000),
      ('t3', 'p1', 3, 's-done', -2, 'Ship it', '', 'medium', '', '', 1300, 4500)`.execute(raw);
  await sql`insert into activities (id, ticket_id, type, actor_kind, actor_name, text,
    review_verdict, review_rating, created_at, edited_at) values
      ('a1', 't1', 'event', 'human', '', 'created the ticket', null, null, 1100, null),
      ('a2', 't1', 'comment', 'agent', 'Claude', 'Logs attached.', null, null, 1200, 1250),
      ('a3', 't3', 'review', 'agent', 'Reviewer', 'Looks good.', 'approved', 5, 1400, null)`.execute(
    raw,
  );
  await sql`insert into attachments (id, ticket_id, activity_id, file_name, mime_type, size, width,
    height, storage_key, created_at) values
      ('f-photo', 't1', null, 'photo.jpg', 'image/jpeg', ${files.photo.byteLength}, 400, 300,
        'f-photo.jpg', 1150),
      ('f-notes', 't1', 'a2', 'notes.txt', 'text/plain', ${files.notes.byteLength}, null, null,
        'f-notes.txt', 1200),
      ('f-tiny', 't3', null, 'tiny.png', 'image/png', ${files.tiny.byteLength}, 3, 2,
        'f-tiny.png', 1300)`.execute(raw);
}

async function laterColumns(db: Db, migration: string) {
  const raw = db.withoutPlugins();
  if (migration >= '0002') {
    await sql`update tickets set client_id = 'capture-1' where id = 't1'`.execute(raw);
  }
  if (migration >= '0003') {
    await sql`update attachments set position = 2 where id = 'f-photo'`.execute(raw);
  }
  if (migration >= '0024') {
    await sql`insert into labels (id, project_id, name, color, template, instructions, position,
      created_at) values ('l-bug', 'p1', 'Bug', '#B42318', '## Steps', 'Reproduce it first.', 0,
      1000)`.execute(raw);
    await sql`insert into ticket_labels (id, ticket_id, label_id, created_at)
      values ('tl1', 't1', 'l-bug', 1100)`.execute(raw);
  }
}

// A local tracker as it is on disk: a SQLite file at `migration` (the user's runs on
// 0003_attachment_position, before sign-in) and its uploads folder.
export async function writeMoveSource(migration = '0003_attachment_position'): Promise<MoveSource> {
  const dir = await tempDir('move-source-');
  const files = {
    photo: await jpegPhoto({ width: 400, height: 300, camera: true }),
    notes: new TextEncoder().encode('Started at 09:00\nCrashed at 09:01\n'),
    tiny: pngBytes(3, 2),
  };
  const source = { dir, file: join(dir, 'tracker.db'), uploads: join(dir, 'uploads'), ...files };
  const db = createDatabase(source.file);
  try {
    const result = await createMigrator(db).migrateTo(migration);
    if (result.error) throw new Error(`Could not migrate the source to ${migration}`);
    await insertRows(db, files);
    await laterColumns(db, migration);
  } finally {
    await db.destroy();
  }
  await mkdir(source.uploads);
  await writeFile(join(source.uploads, 'f-photo.jpg'), files.photo);
  await writeFile(join(source.uploads, 'f-notes.txt'), files.notes);
  await writeFile(join(source.uploads, 'f-tiny.png'), files.tiny);
  return source;
}

export interface MoveTarget {
  db: Db;
  storage: FileStorage;
  // What storage holds, by key.
  stored: () => Promise<Map<string, Buffer>>;
}

const tempDir = async (prefix: string) => {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  onTestFinished(() => rm(dir, { recursive: true, force: true }));
  return dir;
};

// An empty database, not migrated, as Railway's is before the first deploy. Files go to the fake
// S3 when one is given, else to a temporary folder.
export async function openMoveTarget(
  dialect: TestDialect,
  fake: FakeS3 | null,
  pgliteDataDir?: Blob,
): Promise<MoveTarget> {
  const db = openEmptyDatabase(dialect, pgliteDataDir);
  onTestFinished(() => db.destroy());
  if (fake) {
    fake.reset();
    const storage = createS3Storage({ client: fake.client(), bucket: fake.bucket });
    const stored = () =>
      Promise.resolve(
        new Map([...fake.objects].map(([key, bytes]) => [key.slice(S3_KEY_PREFIX.length), bytes])),
      );
    return { db, storage, stored };
  }
  const dir = await tempDir('move-target-');
  const stored = async () =>
    new Map(
      await Promise.all(
        (await readdir(dir)).map(async (key) => [key, await readFile(join(dir, key))] as const),
      ),
    );
  return { db, storage: createDiskStorage(dir), stored };
}

export async function moveData(
  source: MoveSource,
  target: Pick<MoveTarget, 'db' | 'storage'>,
  options: Partial<MoveOptions> = {},
) {
  const lines: string[] = [];
  const ok = await runMove(
    { from: source.file, uploads: source.uploads, dryRun: false, allowExisting: false, ...options },
    {
      db: target.db,
      openStorage: () => Promise.resolve(target.storage),
      say: (line) => lines.push(line),
    },
  );
  return { ok, lines };
}

export async function tableCounts(db: Db): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of Object.keys(SOURCE_COUNTS)) {
    const query = sql<{ n: number | string }>`select count(*) as n from ${sql.table(table)}`;
    counts[table] = Number((await query.execute(db)).rows[0]!.n);
  }
  return counts;
}

export const sha256 = async (file: string) =>
  createHash('sha256')
    .update(await readFile(file))
    .digest('hex');

export function sourceMigrations(file: string): string[] {
  const db = new SQLite(file, { readonly: true });
  try {
    const rows = db.prepare('select name from kysely_migration order by name').all();
    return (rows as { name: string }[]).map((row) => row.name);
  } finally {
    db.close();
  }
}
