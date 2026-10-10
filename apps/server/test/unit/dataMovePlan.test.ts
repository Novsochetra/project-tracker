import { describe, expect, it } from 'vitest';
import type { AttachmentRow } from '../../src/db/schema';
import {
  movedAttachmentRow,
  textsNamingOldFiles,
  type MovedAttachment,
} from '../../src/dataMove/movedAttachment';
import { targetProblems } from '../../src/dataMove/plan';
import { placeOf, refusedImageProblems } from '../../src/dataMove/refusedImages';
import { inChunks, type TableRows } from '../../src/dataMove/rows';
import { sourceFileProblems, totalBytes } from '../../src/dataMove/sourceFiles';
import {
  checkedLine,
  compressionLine,
  compressionTotals,
  describeCounts,
  planLines,
  renamedTextsLine,
} from '../../src/dataMove/summary';
import { COPIED_TABLES } from '../../src/dataMove/tables';
import type { TableCounts } from '../../src/dataMove/rows';
import type { TargetState } from '../../src/dataMove/targetState';
import { stoppedError, stoppedLine } from '../../src/dataMove/stopped';
import { schemaVerdict } from '../../src/dataMove/targetSchema';
import { verificationProblems } from '../../src/dataMove/verify';
import type { MigrationState } from '../../src/db/migrator';
import { fileNameOf } from '../../src/services/attachments';

const NONE: TableCounts = { projects: 0, statuses: 0, tickets: 0, activities: 0, attachments: 0 };

const COUNTS: TableCounts = {
  projects: 1,
  statuses: 5,
  tickets: 130,
  activities: 1283,
  attachments: 3,
};

const PHOTO: AttachmentRow = {
  id: 'f1',
  ticketId: 't1',
  activityId: 'a1',
  fileName: 'IMG_0042.JPG',
  mimeType: 'image/jpeg',
  size: 4_800_000,
  width: 4032,
  height: 3024,
  storageKey: 'f1.jpg',
  position: 3,
  createdAt: 1000,
};

const NOTES: AttachmentRow = {
  ...PHOTO,
  id: 'f2',
  fileName: 'notes.txt',
  mimeType: 'text/plain',
  size: 12,
  width: null,
  height: null,
  storageKey: 'f2.txt',
};

const WEBP = { mimeType: 'image/webp', size: 838_000, width: 2560, height: 1920 } as const;

const moved = (before: AttachmentRow, compressed: boolean): MovedAttachment => ({
  before,
  after: movedAttachmentRow(before, compressed ? WEBP : null),
  compressed,
  refusal: null,
});

const state = (patch: Partial<TargetState>): TargetState => ({
  existing: NONE,
  sameIds: NONE,
  sameKeys: [],
  ...patch,
});

describe('COPIED_TABLES', () => {
  it('copies every table after the tables it points at', () => {
    const names = COPIED_TABLES.map((table) => table.name as string);
    for (const [index, table] of COPIED_TABLES.entries()) {
      for (const parent of table.references) {
        expect(names.indexOf(parent), `${table.name} → ${parent}`).toBeGreaterThanOrEqual(0);
        expect(names.indexOf(parent)).toBeLessThan(index);
      }
    }
  });
});

describe('inChunks', () => {
  it('splits rows into statements of at most the given size', () => {
    expect(inChunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(inChunks([], 2)).toEqual([]);
  });
});

describe('movedAttachmentRow', () => {
  it('keeps the id, owner, place and time, and takes the compressed file as an upload would', () => {
    expect(movedAttachmentRow(PHOTO, WEBP)).toEqual({
      ...PHOTO,
      fileName: 'IMG_0042.webp',
      mimeType: 'image/webp',
      size: 838_000,
      width: 2560,
      height: 1920,
      storageKey: 'f1.webp',
    });
  });

  it('keeps a file it did not compress as it is', () => {
    expect(movedAttachmentRow(NOTES, null)).toEqual(NOTES);
  });

  it('cuts a long name as an upload does', () => {
    const name = `${'a'.repeat(196)}.jpg`;
    const row = movedAttachmentRow({ ...PHOTO, fileName: name }, WEBP);
    expect(row.fileName).toBe(fileNameOf(`${'a'.repeat(196)}.webp`, 'webp'));
    expect(row.fileName.length).toBe(200);
  });

  it('forgets a size Postgres cannot hold, as the server does', () => {
    const row = movedAttachmentRow({ ...PHOTO, width: 4_294_967_295 }, null);
    expect(row).toMatchObject({ width: null, height: 3024 });
  });
});

describe('textsNamingOldFiles', () => {
  it('counts texts naming a renamed file by its old name or key', () => {
    const texts = [
      'See IMG_0042.JPG',
      'stored as data/uploads/f1.jpg',
      'notes.txt says it all',
      'nothing here',
    ];
    expect(textsNamingOldFiles(texts, [moved(PHOTO, true), moved(NOTES, false)])).toBe(2);
    expect(textsNamingOldFiles(texts, [moved(PHOTO, false)])).toBe(0);
  });
});

describe('targetProblems', () => {
  it('lets an empty target or one with only an owner through', () => {
    expect(targetProblems(state({}), false)).toEqual([]);
  });

  it('refuses projects or tickets there unless asked, and says what is there', () => {
    const existing = { ...NONE, projects: 1, statuses: 5, tickets: 2 };
    expect(targetProblems(state({ existing }), false)).toEqual([
      'The target already holds 1 project, 5 statuses, 2 tickets. Moving adds this data next to ' +
        'it; run again with --allow-existing if that is what you want.',
    ]);
    expect(targetProblems(state({ existing }), true)).toEqual([]);
  });

  it('refuses data moved there before, whatever was asked', () => {
    const problems = targetProblems(state({ existing: COUNTS, sameIds: COUNTS }), true);
    expect(problems).toEqual([
      'The target already has 1 project, 5 statuses, 130 tickets, 1283 activity entries, ' +
        '3 attachments with the same ids as this data: it was moved there before. Nothing ' +
        'needs to be moved again.',
    ]);
  });

  it('refuses a project key that is taken', () => {
    const existing = { ...NONE, projects: 1 };
    expect(targetProblems(state({ existing, sameKeys: ['PT'] }), true)).toEqual([
      'The target already has a project with the key PT, and keys are unique. Delete that ' +
        'project in the online tracker first.',
    ]);
  });
});

describe('sourceFileProblems', () => {
  it('names files that are missing or of another size than their rows', () => {
    const files = [
      { row: PHOTO, path: '/up/f1.jpg', size: PHOTO.size },
      { row: NOTES, path: '/up/f2.txt', size: null },
      { row: { ...NOTES, storageKey: 'f3.txt' }, path: '/up/f3.txt', size: 99 },
    ];
    expect(sourceFileProblems('/up', files)).toEqual([
      '1 attachment file(s) are not in /up: f2.txt.',
      '1 file(s) in /up differ in size from their rows: f3.txt.',
    ]);
    expect(sourceFileProblems('/up', files.slice(0, 1))).toEqual([]);
    expect(totalBytes(files)).toBe(PHOTO.size + 99);
  });

  it('lists ten keys and counts the rest', () => {
    const files = Array.from({ length: 12 }, (_, index) => ({
      row: { ...NOTES, storageKey: `k${index}.txt` },
      path: '',
      size: null,
    }));
    expect(sourceFileProblems('/up', files)[0]).toMatch(/k8\.txt, k9\.txt and 2 more\.$/);
  });
});

describe('summary', () => {
  it('describes the tables that have rows', () => {
    expect(describeCounts({ ...NONE, projects: 2, activities: 1 })).toBe(
      '2 projects, 1 activity entry',
    );
    expect(describeCounts(NONE)).toBe('');
  });

  it('lists what will be copied, numbers lined up', () => {
    expect(planLines(COUNTS, { count: 3, bytes: 272_047 })).toEqual([
      'To copy:',
      '  projects        1',
      '  statuses        5',
      '  tickets       130',
      '  activities   1283',
      '  attachments     3',
      '  files           3 (266 KB)',
      'Not copied: users, sessions, api_tokens, runners, runs, run_steps, run_requests, chats, chat_messages ' +
        '(sign-in, ' +
        'helpers and chats stay with each tracker: set the online owner with owner-set, make ' +
        'new API tokens online and start tracker watch against it).',
    ]);
  });

  it('counts the images compressed and the bytes saved', () => {
    const totals = compressionTotals([moved(PHOTO, true), moved(NOTES, false)]);
    expect(totals).toEqual({
      images: 1,
      compressed: 1,
      bytesBefore: 4_800_000,
      bytesAfter: 838_000,
    });
    expect(compressionLine(totals, true)).toBe(
      'Would compress or strip 1 of 1 images, as new uploads are (4.6 MB → 818 KB).',
    );
    expect(compressionLine({ ...totals, compressed: 0 }, false)).toBe(
      'Compressed or stripped 0 of 1 images, as new uploads are.',
    );
  });

  it('says what was checked, and mentions renamed files only when a text names one', () => {
    expect(checkedLine(COUNTS)).toBe(
      'Checked: the target has every row moved (1 project, 5 statuses, 130 tickets, 1283 ' +
        "activity entries, 3 attachments) and every attachment's file, at its size. Done.",
    );
    expect(renamedTextsLine(0)).toEqual([]);
    expect(renamedTextsLine(2)[0]).toMatch(/^2 ticket or comment text\(s\) name a compressed/);
  });
});

describe('verificationProblems', () => {
  it('names tables short of rows, and files missing or of another size', () => {
    expect(
      verificationProblems({
        tables: [
          { name: 'tickets', expected: 130, found: 130 },
          { name: 'activities', expected: 1283, found: 1280 },
        ],
        files: [
          { key: 'f1.webp', expected: 10, found: 10 },
          { key: 'f2.txt', expected: 12, found: null },
          { key: 'f3.txt', expected: 12, found: 11 },
        ],
      }),
    ).toEqual([
      'activities: 1280 of 1283 rows are in the target.',
      'f2.txt: no file in the target storage.',
      'f3.txt: 11 bytes stored, the row says 12.',
    ]);
  });
});

const migration = (name: string, status: MigrationState['status']): MigrationState => ({
  name,
  status,
  appliedAt: status === 'pending' ? null : '2026-10-09T20:00:00.000Z',
});

describe('schemaVerdict', () => {
  const ALL = ['0001_initial', '0002_ticket_client_id'];

  it('migrates only a database with no tables at all', () => {
    const fresh = ALL.map((name) => migration(name, 'pending'));
    expect(schemaVerdict(fresh, 0)).toEqual({ migrate: ALL });
    expect(schemaVerdict(fresh, 2)).toEqual({
      problem:
        'The target has tables but none of the tracker’s migrations, so it is not a tracker ' +
        'database. Check DATABASE_URL.',
    });
  });

  it('takes a database at exactly this build', () => {
    const current = ALL.map((name) => migration(name, 'applied'));
    expect(schemaVerdict(current, 7)).toEqual({ migrate: [] });
  });

  it('leaves a database an older build serves to this commit’s deploy', () => {
    const behind = [
      migration('0001_initial', 'applied'),
      migration('0002_ticket_client_id', 'pending'),
    ];
    expect(schemaVerdict(behind, 5)).toEqual({
      problem:
        'The target is behind this build: it lacks 0002_ticket_client_id. Deploy this same ' +
        'commit first (its pre-deploy step migrates the database), then run the move again.',
    });
  });

  it('refuses a database a newer build migrated', () => {
    const ahead = [
      ...ALL.map((name) => migration(name, 'applied')),
      migration('0099_x', 'unknown'),
    ];
    expect(schemaVerdict(ahead, 7)).toEqual({ problem: expect.stringContaining('0099_x') });
  });
});

describe('stoppedLine', () => {
  it('says whether rows were written and whether running again is safe', () => {
    expect(stoppedLine('no-rows')).toBe(
      'No rows were written to the target, so running the same command again is safe.',
    );
    expect(stoppedLine('committing')).toMatch(/may or may not be in the target\. Running the same/);
    expect(stoppedLine('rows-written')).toMatch(/^The rows were written before it stopped/);
  });

  it('keeps the error’s own message first', () => {
    const error = stoppedError(new Error('connect ECONNREFUSED'), 'no-rows');
    expect(error.message).toBe(`connect ECONNREFUSED\n${stoppedLine('no-rows')}`);
    expect(stoppedError('a string', 'committing').message).toMatch(/^a string\nIt stopped while/);
  });
});

describe('refusedImageProblems', () => {
  const rows = {
    projects: [{ id: 'p1', key: 'PT' }],
    tickets: [{ id: 't1', projectId: 'p1', num: 12, title: 'Secret title' }],
    activities: [{ id: 'a1', type: 'report' }],
  } as unknown as TableRows;
  const place = placeOf(rows);
  const refused = (before: AttachmentRow, refusal: string): MovedAttachment => ({
    before,
    after: before,
    compressed: false,
    refusal,
  });

  it('says where each file is by its ticket key, never its text', () => {
    expect(place(PHOTO)).toBe('a report on PT-12');
    expect(place({ ...PHOTO, activityId: null })).toBe('PT-12');
    expect(place({ ...PHOTO, ticketId: null, activityId: null })).toBe('not on a ticket yet');
  });

  it('names every image that can’t be stored, and nothing when none is', () => {
    const scan = { ...PHOTO, id: 'f-scan', fileName: 'scan.jpg', size: 3_900, activityId: null };
    const problems = refusedImageProblems(
      [moved(NOTES, false), refused(scan, 'Only images can be attached.')],
      place,
    );
    expect(problems).toEqual([
      "1 image(s) can't go online as they are: their metadata (such as where a photo was " +
        'taken) can’t be removed. In the local tracker, remove each one listed with only a ticket ' +
        'key from that ticket’s files. A file on a comment, report or review can’t be removed ' +
        'alone: delete that comment, report or review instead (copy its text first if you want ' +
        'to post it again as a comment, with a copy of the image saved again). Then run the move ' +
        'again:',
      '  - f-scan (PT-12, scan.jpg, 4 KB): Only images can be attached.',
    ]);
    expect(problems.join('\n')).not.toContain('Secret title');
    expect(refusedImageProblems([moved(PHOTO, true), moved(NOTES, false)], place)).toEqual([]);
  });
});
