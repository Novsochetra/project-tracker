import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import type { Database } from '../../src/db/schema';
import { createBroadcaster } from '../../src/events/broadcaster';
import { createMemoryStorage } from '../../src/storage/memoryStorage';
import { inOrderInOneTransaction, loggedPglite } from '../helpers/loggedPglite';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';

const LOCK = /update "projects"/;

// Reviewer of PT-231: on Postgres each statement reads what was committed when it began, so two
// helpers taking two runs of one project at once each counted fewer running than the limit and
// both started. PGlite can't race, so the tests check what stops it: a take holds the project's
// row, in the transaction that starts the run, before it counts. Reviewer of PT-244: a delete
// that locked the runs (by cascade) before the project could then deadlock with a take, so every
// delete takes them in the same order.
describe('regression: a take holds its project while it starts a run (pglite)', () => {
  let db: Kysely<Database>;
  let person: Caller;
  let helper: Caller;
  const sql: string[] = [];
  const runner = randomUUID();

  beforeEach(async () => {
    db = await loggedPglite(sql);
    const app = createApp({ db, storage: createMemoryStorage(), events: createBroadcaster() });
    const user = await addUser(db, 'owner@example.com', Date.now());
    person = caller(() => app, user.person);
    helper = caller(() => app, user.helper);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await person('POST', '/api/projects/MOB/tickets', { title: 'Crash' });
    await helper('PUT', `/api/runners/${runner}`, helperName('Mac'));
    await person('POST', '/api/tickets/MOB-1/runs', { runnerId: runner, prompt: 'Go' });
    sql.length = 0;
  });

  afterEach(async () => {
    await db.destroy();
    sql.length = 0;
  });

  it('locks the project row, then starts the run, in one transaction', async () => {
    expect((await helper('POST', `/api/runners/${runner}/next?kind=ticket`)).status).toBe(200);
    expect(
      inOrderInOneTransaction(sql, LOCK, /update "runs" set "status" = \$1, "started_at"/),
    ).toBe(true);
  });

  it('locks the project row before a ticket delete reaches its runs', async () => {
    expect((await person('DELETE', '/api/tickets/MOB-1')).status).toBe(204);
    expect(inOrderInOneTransaction(sql, LOCK, /delete from "tickets"/)).toBe(true);
  });

  it('locks the project row before a project delete reaches its runs', async () => {
    expect((await person('DELETE', '/api/projects/MOB')).status).toBe(204);
    expect(inOrderInOneTransaction(sql, LOCK, /delete from "tickets"/)).toBe(true);
  });
});
