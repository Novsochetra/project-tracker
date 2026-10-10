import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MIGRATIONS } from '../../src/db/migrations';
import { createMigrator, namesWith, readMigrationState } from '../../src/db/migrator';
import type { Db } from '../../src/db/schema';
import { moveData, openMoveTarget, writeMoveSource } from '../helpers/dataMove';
import { startFakeS3, type FakeS3 } from '../helpers/fakeS3';
import { DIALECTS } from '../helpers/server';

let fake: FakeS3;

beforeAll(async () => {
  fake = await startFakeS3();
});

afterAll(async () => {
  await fake.close();
});

const applied = async (db: Db) => namesWith(await readMigrationState(db), 'applied');

const LATER = Object.keys(MIGRATIONS).filter((name) => name > '0003_attachment_position');

// The move migrated whatever it was pointed at. A database an older build serves (0003) became
// 0004 under it, and that build refuses to start on a database with migrations it lacks: the
// next restart of the online tracker would fail. Only a database with no tables at all is
// migrated now; one behind this build waits for this commit's deploy.
describe.each(DIALECTS)('a move target behind this build (%s)', (dialect) => {
  it.each([false, true])('is refused and left as it is (dry run: %s)', async (dryRun) => {
    const source = await writeMoveSource();
    const target = await openMoveTarget(dialect, fake);
    await createMigrator(target.db).migrateTo('0003_attachment_position');

    const result = await moveData(source, target, { dryRun });

    expect(result.ok).toBe(false);
    expect(result.lines).toContain(
      `  The target is behind this build: it lacks ${LATER.join(', ')}. Deploy this same commit ` +
        'first (its pre-deploy step migrates the database), then run the move again.',
    );
    expect(await applied(target.db)).toEqual([
      '0001_initial',
      '0002_ticket_client_id',
      '0003_attachment_position',
    ]);
    expect(fake.objects.size).toBe(0);
  });

  it('refuses a database with tables of its own and no migrations', async () => {
    const source = await writeMoveSource();
    const target = await openMoveTarget(dialect, fake);
    await sql`create table invoices (id text primary key)`.execute(target.db);

    const result = await moveData(source, target);

    expect(result.ok).toBe(false);
    expect(result.lines.at(-1)).toBe(
      '  The target has tables but none of the tracker’s migrations, so it is not a tracker ' +
        'database. Check DATABASE_URL.',
    );
    expect(await applied(target.db)).toEqual([]);
    expect(fake.objects.size).toBe(0);
  });
});
