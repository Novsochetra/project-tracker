import { randomUUID } from 'node:crypto';
import {
  RUN_NOT_TAKEN,
  HELPER_SILENCE_MS,
  RUNNER_ONLINE_MS,
  RUNNER_REMOVED,
  type Run,
  type RunJob,
  type Runner,
} from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { testClock } from '../helpers/auth';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

describe.each(DIALECTS)('Claude Code runs (%s)', (dialect) => {
  const clock = testClock();
  const api = useTestServer(dialect, { now: clock.now });
  const runner = randomUUID();
  let person: Caller;
  let helper: Caller;

  const start = (ticket = 'MOB-1', prompt = 'Work on MOB-1') =>
    person<Run>('POST', `/api/tickets/${ticket}/runs`, { runnerId: runner, prompt });
  const next = () => helper<RunJob | null>('POST', `/api/runners/${runner}/next`);
  const finish = (id: string, body: unknown) => helper<Run>('POST', `/api/runs/${id}/finish`, body);

  beforeEach(async () => {
    clock.set(1_000_000);
    const owner = await addUser(api.db, 'owner@example.com', clock.now());
    person = caller(() => api.app, owner.person);
    helper = caller(() => api.app, owner.helper);
    expect((await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' })).status).toBe(
      201,
    );
    for (const title of ['Crash', 'Login']) {
      await person('POST', '/api/projects/MOB/tickets', { title });
    }
    expect(
      (await helper('PUT', `/api/runners/${runner}`, helperName('Dara’s MacBook'))).status,
    ).toBe(200);
  });

  it('queues a run on the chosen computer, which takes it with its prompt and reports back', async () => {
    const started = await start('MOB-1', '  Fix the crash on MOB-1  ');
    expect(started.status).toBe(201);
    expect(started.body).toEqual({
      id: expect.any(String),
      kind: 'ticket',
      role: 'work',
      projectKey: 'MOB',
      ticketKey: 'MOB-1',
      chatId: null,
      askOptions: null,
      runnerId: runner,
      runnerName: 'Dara’s MacBook',
      status: 'queued',
      error: null,
      createdAt: 1_000_000,
      startedAt: null,
      endedAt: null,
      stepCount: 0,
    });

    clock.advance(5_000);
    const taken = await next();
    expect(taken.status).toBe(200);
    expect(taken.body).toEqual({
      run: { ...started.body, status: 'running', startedAt: 1_005_000 },
      prompt: 'Fix the crash on MOB-1',
      resumeSessionId: null,
      files: [],
    });
    clock.advance(60_000);
    const done = await finish(started.body.id, { status: 'done', error: 'ignored' });
    expect((await next()).status).toBe(204);
    expect(done.body).toMatchObject({ status: 'done', error: null, endedAt: 1_065_000 });
    const listed = await person<Run[]>('GET', '/api/tickets/MOB-1/runs');
    expect(listed.body.map((run) => run.status)).toEqual(['done']);
    expect((await person('GET', `/api/runs/${started.body.id}`)).body).toEqual(done.body);
  });

  it('takes runs oldest first, one at a time', async () => {
    const first = await start('MOB-1');
    clock.advance(1);
    const second = await start('MOB-2');
    expect((await next()).body).toMatchObject({ run: { id: first.body.id } });
    await finish(first.body.id, { status: 'done' });
    expect((await next()).body).toMatchObject({ run: { id: second.body.id } });
  });

  it('queues a review run when the sheet asks for one, and the helper gets the role with the job', async () => {
    const started = await person<Run>('POST', '/api/tickets/MOB-1/runs', {
      runnerId: runner,
      prompt: 'Review MOB-1',
      role: 'review',
    });
    expect(started.status).toBe(201);
    expect(started.body.role).toBe('review');
    expect((await next()).body?.run).toMatchObject({ id: started.body.id, role: 'review' });
    const listed = await person<Run[]>('GET', '/api/tickets/MOB-1/runs');
    expect(listed.body.map((run) => run.role)).toEqual(['review']);
  });

  it('refuses a role it does not know', async () => {
    const refused = await person('POST', '/api/tickets/MOB-1/runs', {
      runnerId: runner,
      prompt: 'Go',
      role: 'boss',
    });
    expect(refused.status).toBe(400);
    expect(await api.db.selectFrom('runs').selectAll().execute()).toEqual([]);
  });

  it('reads a run queued before there were roles as a work run', async () => {
    const started = await start();
    await api.db.updateTable('runs').set({ role: null }).execute();
    expect((await next()).body?.run.role).toBe('work');
    expect((await person<Run>('GET', `/api/runs/${started.body.id}`)).body.role).toBe('work');
  });

  it('lets only a person start a run: an agent token gets 403 before its body is read', async () => {
    const refused = await helper('POST', '/api/tickets/MOB-1/runs', { runnerId: 'nope' });
    expect(refused.status).toBe(403);
    expect(await api.db.selectFrom('runs').selectAll().execute()).toEqual([]);
  });

  it('runs one Claude at a time on a ticket', async () => {
    const first = await start();
    const again = await start();
    expect(again.status).toBe(409);
    expect(again.body).toMatchObject({ error: { message: 'Claude is already working on MOB-1.' } });
    await next();
    expect((await start()).status).toBe(409);
    await finish(first.body.id, { status: 'failed', error: 'claude exited with 1' });
    expect((await start()).status).toBe(201);
  });

  it('refuses a computer that does not run the project, and one that does not exist', async () => {
    await person('POST', '/api/projects', { name: 'Web', key: 'WEB' });
    await person('POST', '/api/projects/WEB/tickets', { title: 'Footer' });
    const wrongProject = await start('WEB-1');
    expect(wrongProject.status).toBe(409);
    expect(wrongProject.body).toMatchObject({
      error: { message: "Dara’s MacBook doesn't run WEB. Start tracker watch there." },
    });
    const unknown = await person('POST', '/api/tickets/MOB-1/runs', {
      runnerId: randomUUID(),
      prompt: 'Go',
    });
    expect(unknown.status).toBe(404);
  });

  it('fails a run no computer takes in time, so the phone stops waiting', async () => {
    const started = await start();
    clock.advance(HELPER_SILENCE_MS);
    const read = await person<Run>('GET', `/api/runs/${started.body.id}`);
    expect(read.body).toMatchObject({
      status: 'failed',
      error: RUN_NOT_TAKEN,
      endedAt: 1_000_000 + HELPER_SILENCE_MS,
    });
    expect((await next()).status).toBe(204);
    expect((await start()).status).toBe(201);
  });

  it('cancels a run; the helper saying so again is fine, saying done is not', async () => {
    const started = await start();
    await next();
    const cancelled = await person<Run>('POST', `/api/runs/${started.body.id}/cancel`);
    expect(cancelled.body).toMatchObject({ status: 'cancelled', error: null });
    expect((await finish(started.body.id, { status: 'cancelled' })).status).toBe(200);
    const late = await finish(started.body.id, { status: 'done' });
    expect(late.status).toBe(409);
    expect(late.body).toMatchObject({ error: { message: 'This run already ended (cancelled).' } });
  });

  it('keeps helper calls for helpers: a browser session gets 403', async () => {
    const id = randomUUID();
    expect((await person('PUT', `/api/runners/${id}`, helperName('Browser'))).status).toBe(403);
    expect((await person('POST', `/api/runners/${runner}/next`)).status).toBe(403);
    const started = await start();
    expect(
      (await person('POST', `/api/runs/${started.body.id}/finish`, { status: 'done' })).status,
    ).toBe(403);
  });

  it('shows a computer online while it checks in, with its projects', async () => {
    const listed = async () => (await person<Runner[]>('GET', '/api/runners')).body;
    expect(await listed()).toEqual([
      {
        id: runner,
        name: 'Dara’s MacBook',
        projectKeys: ['MOB'],
        createdAt: 1_000_000,
        lastSeenAt: 1_000_000,
        online: true,
      },
    ]);
    clock.advance(RUNNER_ONLINE_MS);
    expect((await listed())[0]!.online).toBe(false);
    await next();
    expect((await listed())[0]).toMatchObject({
      online: true,
      lastSeenAt: 1_000_000 + RUNNER_ONLINE_MS,
    });
  });

  it('keeps a run queued for a computer that restarts with the same id', async () => {
    const started = await start();
    clock.advance(10 * 60_000);
    await helper('PUT', `/api/runners/${runner}`, helperName('Dara’s MacBook'));
    expect((await next()).body).toMatchObject({ run: { id: started.body.id, status: 'running' } });
  });

  it('ends the runs of a computer the person removes', async () => {
    const started = await start();
    expect((await person('DELETE', `/api/runners/${runner}`)).status).toBe(204);
    const read = await person<Run>('GET', `/api/runs/${started.body.id}`);
    expect(read.body).toMatchObject({ status: 'failed', error: RUNNER_REMOVED, runnerId: null });
    expect((await person<Runner[]>('GET', '/api/runners')).body).toEqual([]);
  });

  it('checks the input', async () => {
    expect((await helper('PUT', '/api/runners/not-a-uuid', helperName('Mac'))).status).toBe(400);
    expect(
      (await helper('PUT', `/api/runners/${runner}`, { name: 'Mac', projectKeys: ['NOPE'] }))
        .status,
    ).toBe(404);
    expect(
      (await person('POST', '/api/tickets/MOB-1/runs', { runnerId: runner, prompt: '  ' })).status,
    ).toBe(400);
  });
});

describe.each(DIALECTS)('Claude Code runs on a tracker without an owner (%s)', (dialect) => {
  const api = useTestServer(dialect);
  const anyone = caller(() => api.app, {});

  it('works for the one person on this computer', async () => {
    const runner = randomUUID();
    await anyone('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await anyone('POST', '/api/projects/MOB/tickets', { title: 'Crash' });
    expect((await anyone('PUT', `/api/runners/${runner}`, helperName('Mac'))).status).toBe(200);
    const started = await anyone<Run>('POST', '/api/tickets/MOB-1/runs', {
      runnerId: runner,
      prompt: 'Go',
    });
    expect(started.status).toBe(201);
    const taken = await anyone<RunJob>('POST', `/api/runners/${runner}/next`);
    expect(taken.body.prompt).toBe('Go');
  });
});
