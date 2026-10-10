import { randomUUID } from 'node:crypto';
import type { Run, Runner } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

interface Side {
  person: Caller;
  helper: Caller;
  runner: string;
}

// Only one account signs in today, but runs are built for many: user B must never see, take,
// start, end or take over anything of user A's, and the other way round.
describe.each(DIALECTS)("one user's runs stay theirs (%s)", (dialect) => {
  const api = useTestServer(dialect);
  let a: Side;
  let b: Side;
  let aRun: Run;

  async function side(email: string, createdAt: number): Promise<Side> {
    const user = await addUser(api.db, email, createdAt);
    return {
      person: caller(() => api.app, user.person),
      helper: caller(() => api.app, user.helper),
      runner: randomUUID(),
    };
  }

  beforeEach(async () => {
    a = await side('a@example.com', Date.now());
    b = await side('b@example.com', Date.now() + 1);
    await a.person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await a.person('POST', '/api/projects/MOB/tickets', { title: 'Crash' });
    await a.person('POST', '/api/projects/MOB/tickets', { title: 'Login' });
    // Both helpers serve the same project, the closest two users can come today.
    await a.helper('PUT', `/api/runners/${a.runner}`, helperName('A Mac'));
    await b.helper('PUT', `/api/runners/${b.runner}`, helperName('B Mac'));
    const started = await a.person<Run>('POST', '/api/tickets/MOB-1/runs', {
      runnerId: a.runner,
      prompt: 'Work on MOB-1',
    });
    expect(started.status).toBe(201);
    aRun = started.body;
  });

  it("never hands A's run to B's helper, even for a project both serve", async () => {
    expect((await b.helper('POST', `/api/runners/${b.runner}/next`)).status).toBe(204);
    expect((await a.helper('POST', `/api/runners/${a.runner}/next`)).status).toBe(200);
  });

  it("answers 404 to B for A's computer, so B can't take from it or learn it exists", async () => {
    const next = await b.helper('POST', `/api/runners/${a.runner}/next`);
    expect(next.status).toBe(404);
    expect((await b.person('DELETE', `/api/runners/${a.runner}`)).status).toBe(404);
    const takeOver = await b.helper('PUT', `/api/runners/${a.runner}`, helperName('Mine now'));
    expect(takeOver.status).toBe(404);
    const aRunners = (await a.person<Runner[]>('GET', '/api/runners')).body;
    expect(aRunners).toMatchObject([{ id: a.runner, name: 'A Mac' }]);
    expect((await a.helper('POST', `/api/runners/${a.runner}/next`)).status).toBe(200);
  });

  it("answers 404 to B for A's run, by session and by token", async () => {
    for (const as of [b.person, b.helper]) {
      expect((await as('GET', `/api/runs/${aRun.id}`)).status).toBe(404);
      expect((await as('POST', `/api/runs/${aRun.id}/cancel`)).status).toBe(404);
    }
    const finish = await b.helper('POST', `/api/runs/${aRun.id}/finish`, { status: 'done' });
    expect(finish.status).toBe(404);
    expect((await a.person<Run>('GET', `/api/runs/${aRun.id}`)).body.status).toBe('queued');
  });

  it("lists only one's own runs and computers", async () => {
    expect((await b.person<Run[]>('GET', '/api/tickets/MOB-1/runs')).body).toEqual([]);
    expect((await a.person<Run[]>('GET', '/api/tickets/MOB-1/runs')).body).toEqual([aRun]);
    expect((await b.person<Runner[]>('GET', '/api/runners')).body).toMatchObject([
      { id: b.runner, name: 'B Mac' },
    ]);
  });

  it('runs one Claude per ticket, whoever started it, and tells B nothing more', async () => {
    const blocked = await b.person('POST', '/api/tickets/MOB-1/runs', {
      runnerId: b.runner,
      prompt: 'Work on MOB-1',
    });
    expect(blocked).toEqual({
      status: 409,
      body: { error: { code: 'conflict', message: 'Claude is already working on MOB-1.' } },
    });
  });

  it("won't let A start a run on B's computer", async () => {
    const started = await a.person('POST', '/api/tickets/MOB-2/runs', {
      runnerId: b.runner,
      prompt: 'Work on MOB-2',
    });
    expect(started.status).toBe(404);
    expect((await b.helper('POST', `/api/runners/${b.runner}/next`)).status).toBe(204);
  });

  it('keeps runs from a tracker without an owner away from every signed-in user', async () => {
    await api.db.updateTable('runs').set({ userId: null }).where('id', '=', aRun.id).execute();
    expect((await a.person('GET', `/api/runs/${aRun.id}`)).status).toBe(404);
    expect((await a.helper('POST', `/api/runners/${a.runner}/next`)).status).toBe(204);
  });
});
