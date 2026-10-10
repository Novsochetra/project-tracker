import {
  InsertQueryNode,
  type KyselyPlugin,
  type PluginTransformQueryArgs,
  type PluginTransformResultArgs,
  type RootOperationNode,
} from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FileStorage } from '../../src/storage/fileStorage';
import { moveData, openMoveTarget, tableCounts, writeMoveSource } from '../helpers/dataMove';
import { startFakeS3, type FakeS3 } from '../helpers/fakeS3';
import { DIALECTS } from '../helpers/server';

const NO_ROWS = 'No rows were written to the target, so running the same command again is safe.';

let fake: FakeS3;

beforeAll(async () => {
  fake = await startFakeS3();
});

afterAll(async () => {
  await fake.close();
});

function failingInsertInto(table: string): KyselyPlugin {
  return {
    transformQuery({ node }: PluginTransformQueryArgs): RootOperationNode {
      if (InsertQueryNode.is(node) && node.into?.table.identifier.name === table) {
        throw new Error('connect ECONNREFUSED 10.0.0.1:5432');
      }
      return node;
    },
    transformResult: ({ result }: PluginTransformResultArgs) => Promise.resolve(result),
  };
}

const refusingWrites = (storage: FileStorage): FileStorage => ({
  ...storage,
  async write(_key, body) {
    await body.cancel();
    throw new Error('S3 upload failed: AccessDenied, HTTP 403');
  },
});

const failingStat = (storage: FileStorage): FileStorage => ({
  ...storage,
  stat: () => Promise.reject(new Error('read ECONNRESET')),
});

// Step 9 tells the user a failed run can simply run again, but an error ended the move with only
// its own message ("S3 upload failed: AccessDenied"), never saying whether rows had been written.
describe.each(DIALECTS)('a move that stops on an error (%s)', (dialect) => {
  it('says no rows were written when copying a file fails', async () => {
    const source = await writeMoveSource();
    const target = await openMoveTarget(dialect, fake);

    const run = moveData(source, { db: target.db, storage: refusingWrites(target.storage) });

    await expect(run).rejects.toThrow(`S3 upload failed: AccessDenied, HTTP 403\n${NO_ROWS}`);
  });

  it('says no rows were written when writing them fails', async () => {
    const source = await writeMoveSource();
    const target = await openMoveTarget(dialect, fake);
    const db = target.db.withPlugin(failingInsertInto('activities'));

    await expect(moveData(source, { ...target, db })).rejects.toThrow(
      `connect ECONNREFUSED 10.0.0.1:5432\n${NO_ROWS}`,
    );
    expect((await tableCounts(target.db)).projects).toBe(0);
  });

  it('says the rows were written when only the check after them fails', async () => {
    const source = await writeMoveSource();
    const target = await openMoveTarget(dialect, fake);

    const run = moveData(source, { db: target.db, storage: failingStat(target.storage) });

    await expect(run).rejects.toThrow(/^read ECONNRESET\nThe rows were written before it stopped/);
    expect((await tableCounts(target.db)).projects).toBe(1);
  });
});
