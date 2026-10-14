import { CompiledQuery, sql, type Compilable } from 'kysely';
import { afterEach, describe, expect, it } from 'vitest';
import type { Db } from '../../src/db/schema';
import { chatTokensQuery, latestContextQuery } from '../../src/repositories/chatContext';
import { latestChatRunQuery, stoppedChatRunsQuery } from '../../src/repositories/runs';
import { createTestDatabase, DIALECTS } from '../helpers/server';

const INDEX = 'runs_chat_created_idx';

async function plan(db: Db, dialect: string, query: Compilable): Promise<string> {
  const { sql: text, parameters } = query.compile();
  const prefix = dialect === 'sqlite' ? 'explain query plan ' : 'explain ';
  const result = await db.executeQuery(CompiledQuery.raw(prefix + text, [...parameters]));
  return JSON.stringify(result.rows);
}

// Postgres plans a seq scan for a handful of rows whatever the indexes, so it is told not to.
describe.each(DIALECTS)("a chat's run reads use its index (%s)", (dialect) => {
  let db: Db;

  afterEach(() => db.destroy());

  it('reads the latest ask and the stopped ones through runs_chat_created_idx', async () => {
    db = await createTestDatabase(dialect);
    if (dialect === 'pglite') await sql`set enable_seqscan = off`.execute(db);
    expect(await plan(db, dialect, latestChatRunQuery(db, 'u-1', 'c-1'))).toContain(INDEX);
    expect(await plan(db, dialect, stoppedChatRunsQuery(db, 'u-1', 'c-1'))).toContain(INDEX);
  });

  it("reads the chat's context and its tokens through runs_chat_created_idx", async () => {
    db = await createTestDatabase(dialect);
    if (dialect === 'pglite') await sql`set enable_seqscan = off`.execute(db);
    expect(await plan(db, dialect, latestContextQuery(db, 'c-1'))).toContain(INDEX);
    expect(await plan(db, dialect, chatTokensQuery(db, 'c-1'))).toContain(INDEX);
  });
});
