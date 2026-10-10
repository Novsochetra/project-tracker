import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createApp } from '../../src/app';
import { MIGRATIONS } from '../../src/db/migrations';
import { createBroadcaster } from '../../src/events/broadcaster';
import {
  moveData,
  openMoveTarget,
  sha256,
  SOURCE_COUNTS,
  sourceMigrations,
  tableCounts,
  writeMoveSource,
} from '../helpers/dataMove';
import { startFakeS3, type FakeS3 } from '../helpers/fakeS3';
import { containsText } from '../helpers/images';
import { clientFor, DIALECTS } from '../helpers/server';

const STORAGES = ['disk', 's3'] as const;

let fake: FakeS3;

beforeAll(async () => {
  fake = await startFakeS3();
});

afterAll(async () => {
  await fake.close();
});

const openTarget = (dialect: (typeof DIALECTS)[number], kind: (typeof STORAGES)[number]) =>
  openMoveTarget(dialect, kind === 's3' ? fake : null);

const isWebp = (bytes: Buffer) =>
  bytes.subarray(0, 4).toString('latin1') === 'RIFF' &&
  bytes.subarray(8, 12).toString('latin1') === 'WEBP';

describe.each(DIALECTS.flatMap((dialect) => STORAGES.map((kind) => [dialect, kind] as const)))(
  'moving a local tracker into %s with files on %s',
  (dialect, kind) => {
    it('copies every row with its id and every file, the photo compressed as an upload is', async () => {
      const source = await writeMoveSource();
      const before = await sha256(source.file);
      const target = await openTarget(dialect, kind);
      const { ok, lines } = await moveData(source, target);

      expect(ok).toBe(true);
      expect(lines.at(-1)).toMatch(/^Checked: the target has every row moved/);
      expect(lines).toContainEqual(
        expect.stringMatching(
          /^Compressed or stripped 1 of 2 images, as new uploads are \(\d+ K?B → \d+ K?B\)\.$/,
        ),
      );
      expect(await tableCounts(target.db)).toEqual(SOURCE_COUNTS);
      const project = await target.db.selectFrom('projects').selectAll().executeTakeFirstOrThrow();
      expect(project).toMatchObject({ id: 'p1', key: 'MOB', nextNum: 4, updatedAt: 5000 });
      const tickets = await target.db.selectFrom('tickets').selectAll().orderBy('num').execute();
      expect(tickets.map((t) => [t.id, t.num, t.rank, t.statusId, t.clientId, t.due])).toEqual([
        ['t1', 1, 0, 's-todo', 'capture-1', '2026-11-01'],
        ['t3', 3, -2, 's-done', null, ''],
      ]);
      const review = await target.db
        .selectFrom('activities')
        .selectAll()
        .where('id', '=', 'a3')
        .executeTakeFirstOrThrow();
      expect(review).toMatchObject({
        reviewVerdict: 'approved',
        reviewRating: 5,
        createdAt: 1400,
      });

      const files = await target.stored();
      expect([...files.keys()].sort()).toEqual(['f-notes.txt', 'f-photo.webp', 'f-tiny.png']);
      const photo = files.get('f-photo.webp')!;
      expect(isWebp(photo)).toBe(true);
      expect(containsText(photo, 'iPhone 15 Pro')).toBe(false);
      expect(files.get('f-notes.txt')).toEqual(Buffer.from(source.notes));
      expect(files.get('f-tiny.png')).toEqual(Buffer.from(source.tiny));
      const attachments = await target.db
        .selectFrom('attachments')
        .selectAll()
        .orderBy('createdAt')
        .execute();
      expect(attachments).toEqual([
        {
          id: 'f-photo',
          ticketId: 't1',
          activityId: null,
          fileName: 'photo.webp',
          mimeType: 'image/webp',
          size: photo.byteLength,
          width: 400,
          height: 300,
          storageKey: 'f-photo.webp',
          position: 2,
          createdAt: 1150,
        },
        expect.objectContaining({ id: 'f-notes', storageKey: 'f-notes.txt', activityId: 'a2' }),
        expect.objectContaining({ id: 'f-tiny', storageKey: 'f-tiny.png', ticketId: 't3' }),
      ]);
      expect(lines.some((line) => line.startsWith('1 ticket or comment text(s) name'))).toBe(true);

      expect(await sha256(source.file)).toBe(before);
      expect(sourceMigrations(source.file)).toEqual([
        '0001_initial',
        '0002_ticket_client_id',
        '0003_attachment_position',
      ]);
    });

    it('serves the moved tickets, comments and files under the same keys and links', async () => {
      const source = await writeMoveSource();
      const target = await openTarget(dialect, kind);
      expect((await moveData(source, target)).ok).toBe(true);
      const app = createApp({
        db: target.db,
        storage: target.storage,
        events: createBroadcaster(),
      });
      const client = clientFor(app);

      const detail = await client.getTicket('MOB-1');
      expect(detail.ticket.title).toBe('Crash on launch');
      expect(detail.attachments.map((file) => [file.fileName, file.url])).toEqual([
        ['photo.webp', '/api/attachments/f-photo/file'],
      ]);
      const comment = detail.activity.find((item) => item.id === 'a2')!;
      expect(comment.attachments.map((file) => file.fileName)).toEqual(['notes.txt']);
      const response = await app.request('/api/attachments/f-photo/file');
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('image/webp');
      expect(Buffer.from(await response.arrayBuffer())).toEqual(
        (await target.stored()).get('f-photo.webp'),
      );
      expect(await client.fetchAttachmentText('f-notes')).toBe(
        new TextDecoder().decode(source.notes),
      );

      const created = await client.createTicket('MOB', { title: 'Made online' });
      expect(created.key).toBe('MOB-4');
    });
  },
);

describe.each(DIALECTS)('a dry run into %s', (dialect) => {
  it('says what it would copy and changes nothing', async () => {
    const source = await writeMoveSource();
    const before = await sha256(source.file);
    const target = await openTarget(dialect, 's3');
    const { ok, lines } = await moveData(source, target, { dryRun: true });

    expect(ok).toBe(true);
    expect(lines).toEqual(
      expect.arrayContaining([
        'To copy:',
        '  projects     1',
        '  statuses     2',
        '  tickets      2',
        '  activities   3',
        '  attachments  3',
        expect.stringMatching(/^ {2}files {8}3 \(\d+ KB\)$/),
        `Would migrate the empty target first: ${Object.keys(MIGRATIONS).join(', ')}.`,
        expect.stringMatching(
          /^Would compress or strip 1 of 2 images, as new uploads are \(\d+ K?B → \d+ K?B\)\.$/,
        ),
        'Dry run: nothing was written.',
      ]),
    );
    expect(await target.db.introspection.getTables()).toEqual([]);
    expect(fake.calls).toEqual([]);
    expect(await sha256(source.file)).toBe(before);
  });
});

describe.each(DIALECTS)('a source on the first schema into %s', (dialect) => {
  it('migrates a copy of it, never the file, and moves its rows', async () => {
    const source = await writeMoveSource('0001_initial');
    const before = await sha256(source.file);
    const target = await openTarget(dialect, 'disk');
    const { ok, lines } = await moveData(source, target);

    expect(ok).toBe(true);
    expect(lines).toContain(
      `Migrated a copy of ${source.file} (not the file): ` +
        `${Object.keys(MIGRATIONS).slice(1).join(', ')}.`,
    );
    expect(await tableCounts(target.db)).toEqual(SOURCE_COUNTS);
    const rows = await target.db.selectFrom('attachments').select(['id', 'position']).execute();
    expect(rows.every((row) => row.position === 0)).toBe(true);
    expect(await sha256(source.file)).toBe(before);
    expect(sourceMigrations(source.file)).toEqual(['0001_initial']);
  });
});
