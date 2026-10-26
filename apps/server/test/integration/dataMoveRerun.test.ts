import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import {
  InsertQueryNode,
  type KyselyPlugin,
  type PluginTransformQueryArgs,
  type PluginTransformResultArgs,
  type RootOperationNode,
} from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrateToLatest } from '../../src/db/migrator';
import type { Db } from '../../src/db/schema';
import type { FileStorage } from '../../src/storage/fileStorage';
import {
  moveData,
  openMoveTarget,
  SOURCE_COUNTS,
  tableCounts,
  writeMoveSource,
} from '../helpers/dataMove';
import { startFakeS3, type FakeS3 } from '../helpers/fakeS3';
import { DIALECTS } from '../helpers/server';

const NOTHING = { projects: 0, statuses: 0, tickets: 0, activities: 0, attachments: 0 };

let fake: FakeS3;

beforeAll(async () => {
  fake = await startFakeS3();
});

afterAll(async () => {
  await fake.close();
});

// Fails the insert into one table, as a connection dropped in the middle of the transaction would.
function failingInsertInto(table: string): KyselyPlugin {
  return {
    transformQuery({ node }: PluginTransformQueryArgs): RootOperationNode {
      if (InsertQueryNode.is(node) && node.into?.table.identifier.name === table) {
        throw new Error('The connection dropped.');
      }
      return node;
    },
    transformResult: ({ result }: PluginTransformResultArgs) => Promise.resolve(result),
  };
}

function failingAfter(storage: FileStorage, writes: number): FileStorage {
  let written = 0;
  return {
    ...storage,
    async write(key, body) {
      written += 1;
      if (written <= writes) return storage.write(key, body);
      await body.cancel();
      throw new Error('S3 stopped answering.');
    },
  };
}

async function addOtherProject(db: Db, key: string): Promise<void> {
  await migrateToLatest(db);
  await db
    .insertInto('projects')
    .values({
      id: 'p-web',
      name: 'Website',
      key,
      description: '',
      repo: '',
      instructions: '',
      color: '#5B5BD6',
      hideName: 0,
      nextNum: 2,
      createdAt: 1,
      updatedAt: 1,
    })
    .execute();
  await db
    .insertInto('statuses')
    .values({
      id: 's-web',
      projectId: 'p-web',
      name: 'To do',
      category: 'todo',
      color: '#8B8D98',
      position: 0,
      createdAt: 1,
    })
    .execute();
  await db
    .insertInto('tickets')
    .values({
      id: 't-web',
      projectId: 'p-web',
      num: 1,
      statusId: 's-web',
      rank: 0,
      title: 'Made online',
      description: '',
      priority: 'medium',
      assignee: '',
      due: '',
      needsDevice: 0,
      createdAt: 1,
      updatedAt: 1,
      clientId: null,
    })
    .execute();
}

describe.each(DIALECTS)('running the move again (%s)', (dialect) => {
  it('keeps no rows when writing them fails, and the next run moves everything', async () => {
    const source = await writeMoveSource();
    const target = await openMoveTarget(dialect, fake);
    const failing = { ...target, db: target.db.withPlugin(failingInsertInto('attachments')) };

    await expect(moveData(source, failing)).rejects.toThrow('The connection dropped.');
    expect(await tableCounts(target.db)).toEqual(NOTHING);
    expect([...(await target.stored()).keys()].sort()).toEqual([
      'f-notes.txt',
      'f-photo.webp',
      'f-tiny.png',
    ]);

    const again = await moveData(source, target);
    expect(again.ok).toBe(true);
    expect(again.lines.at(-1)).toMatch(/^Checked:/);
    expect(await tableCounts(target.db)).toEqual(SOURCE_COUNTS);
    expect((await target.stored()).size).toBe(3);
  });

  it('writes no rows when copying the files fails, and the next run moves everything', async () => {
    const source = await writeMoveSource();
    const target = await openMoveTarget(dialect, fake);

    await expect(
      moveData(source, { db: target.db, storage: failingAfter(target.storage, 1) }),
    ).rejects.toThrow('S3 stopped answering.');
    expect(await tableCounts(target.db)).toEqual(NOTHING);
    expect((await target.stored()).size).toBe(1);

    expect((await moveData(source, target)).ok).toBe(true);
    expect(await tableCounts(target.db)).toEqual(SOURCE_COUNTS);
    expect((await target.stored()).size).toBe(3);
  });

  it('refuses to move the same data twice, even when asked to add to what is there', async () => {
    const source = await writeMoveSource();
    const target = await openMoveTarget(dialect, fake);
    expect((await moveData(source, target)).ok).toBe(true);

    const again = await moveData(source, target, { allowExisting: true });

    expect(again.ok).toBe(false);
    expect(again.lines).toContain(
      '  The target already has 1 project, 2 statuses, 2 tickets, 3 activity entries, ' +
        '3 attachments with the same ids as this data: it was moved there before. Nothing ' +
        'needs to be moved again.',
    );
    expect(await tableCounts(target.db)).toEqual(SOURCE_COUNTS);
  });
});

describe.each(DIALECTS)('a target that holds data already (%s)', (dialect) => {
  it('is refused with what it holds, and added to only when asked', async () => {
    const source = await writeMoveSource();
    const target = await openMoveTarget(dialect, fake);
    await addOtherProject(target.db, 'WEB');

    const refused = await moveData(source, target);

    expect(refused.ok).toBe(false);
    expect(refused.lines.slice(-2)).toEqual([
      'Nothing was moved:',
      '  The target already holds 1 project, 1 status, 1 ticket. Moving adds this data next to ' +
        'it; run again with --allow-existing if that is what you want.',
    ]);
    expect(fake.objects.size).toBe(0);
    expect(await tableCounts(target.db)).toEqual({
      ...NOTHING,
      projects: 1,
      statuses: 1,
      tickets: 1,
    });

    expect((await moveData(source, target, { allowExisting: true })).ok).toBe(true);
    expect(await tableCounts(target.db)).toEqual({
      projects: 2,
      statuses: 3,
      tickets: 3,
      activities: 3,
      attachments: 3,
    });
  });

  it('is refused when one of its projects has the same key', async () => {
    const source = await writeMoveSource();
    const target = await openMoveTarget(dialect, fake);
    await addOtherProject(target.db, 'MOB');

    const refused = await moveData(source, target, { allowExisting: true });

    expect(refused.ok).toBe(false);
    expect(refused.lines.at(-1)).toBe(
      '  The target already has a project with the key MOB, and keys are unique. Delete that ' +
        'project in the online tracker first.',
    );
    expect(fake.objects.size).toBe(0);
  });
});

describe.each(DIALECTS)('a source with a file missing (%s)', (dialect) => {
  it('is refused before anything touches the target', async () => {
    const source = await writeMoveSource();
    await rm(join(source.uploads, 'f-notes.txt'));
    const target = await openMoveTarget(dialect, fake);

    const refused = await moveData(source, target);

    expect(refused.ok).toBe(false);
    expect(refused.lines.at(-1)).toBe(
      `  1 attachment file(s) are not in ${source.uploads}: f-notes.txt.`,
    );
    expect(await target.db.introspection.getTables()).toEqual([]);
    expect(fake.calls).toEqual([]);
  });
});
