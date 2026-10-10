import { randomUUID } from 'node:crypto';
import {
  RUN_REQUEST_DEADLINE_MS,
  type AddRunRequestInput,
  type Run,
  type RunRequest,
} from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { testClock } from '../helpers/auth';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

const QUESTIONS = [
  {
    question: 'Which color should the button be?',
    header: 'Color',
    options: [
      { label: 'Red', description: '' },
      { label: 'Green', description: '' },
    ],
    multiSelect: false,
  },
];

describe.each(DIALECTS)('run requests (%s)', (dialect) => {
  const clock = testClock();
  const api = useTestServer(dialect, { now: clock.now });
  let person: Caller;
  let helper: Caller;
  let other: { person: Caller; helper: Caller };
  let runner: string;
  let run: Run;

  const permission = (label = 'Run npm test'): AddRunRequestInput => ({
    runnerId: runner,
    kind: 'permission',
    label,
    questions: null,
  });
  const ask = (input: AddRunRequestInput = permission(), as = helper) =>
    as<RunRequest>('POST', `/api/runs/${run.id}/requests`, input);
  const list = (as = person) => as<RunRequest[]>('GET', `/api/runs/${run.id}/requests`);
  const answer = (id: string, body: unknown, as = person) =>
    as<RunRequest>('POST', `/api/requests/${id}/answer`, body);
  const wait = (id: string, as = helper) => as<RunRequest>('GET', `/api/requests/${id}/wait`);
  const take = () => helper('POST', `/api/runners/${runner}/next`);
  const checkIn = () => helper('PUT', `/api/runners/${runner}`, helperName('A Mac'));
  const opened = async (input?: AddRunRequestInput) => (await ask(input)).body;

  beforeEach(async () => {
    clock.set(Date.now());
    const a = await addUser(api.db, 'a@example.com', clock.now());
    const b = await addUser(api.db, 'b@example.com', clock.now() + 1);
    person = caller(() => api.app, a.person);
    helper = caller(() => api.app, a.helper);
    other = { person: caller(() => api.app, b.person), helper: caller(() => api.app, b.helper) };
    runner = randomUUID();
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await person('POST', '/api/projects/MOB/tickets', { title: 'Crash' });
    await checkIn();
    run = (await person<Run>('POST', '/api/tickets/MOB-1/runs', { runnerId: runner, prompt: 'Go' }))
      .body;
  });

  it('keeps what the helper asks, and the answer the person gives, for the helper to read', async () => {
    await take();
    const created = await ask();
    expect(created).toEqual({
      status: 201,
      body: {
        id: expect.any(String),
        runId: run.id,
        kind: 'permission',
        label: 'Run npm test',
        questions: null,
        status: 'open',
        decision: null,
        answers: null,
        createdAt: clock.now(),
        expiresAt: clock.now() + RUN_REQUEST_DEADLINE_MS,
        endedAt: null,
      },
    });
    expect((await list()).body).toEqual([created.body]);
    const waiting = wait(created.body.id);
    const answered = await answer(created.body.id, { decision: 'allow' });
    expect(answered.body).toMatchObject({ status: 'answered', decision: 'allow', answers: null });
    expect((await waiting).body).toEqual(answered.body);
    expect((await wait(created.body.id)).body).toEqual(answered.body);
  });

  it('gives a question its choices and gets back the chosen one', async () => {
    await take();
    const question = await opened({
      runnerId: runner,
      kind: 'question',
      label: QUESTIONS[0]!.question,
      questions: QUESTIONS,
    });
    expect(question.questions).toEqual(QUESTIONS);
    expect((await answer(question.id, { decision: 'allow' })).status).toBe(400);
    const picked = await answer(question.id, { decision: 'allow', answers: ['Green'] });
    expect(picked.body).toMatchObject({
      status: 'answered',
      decision: 'allow',
      answers: ['Green'],
    });
    expect((await wait(question.id)).body.answers).toEqual(['Green']);
  });

  it('takes requests only from the helper that took the run, while it runs', async () => {
    expect(await ask()).toMatchObject({
      status: 409,
      body: { error: { message: 'This run is not running (queued).' } },
    });
    await take();
    expect((await ask(permission(), person)).status).toBe(403);
    const otherRunner = randomUUID();
    await helper('PUT', `/api/runners/${otherRunner}`, helperName('A iMac'));
    expect(await ask({ ...permission(), runnerId: otherRunner })).toMatchObject({
      status: 403,
      body: { error: { message: 'Only the helper that took this run asks in it.' } },
    });
    await helper('POST', `/api/runs/${run.id}/finish`, { status: 'done' });
    expect((await ask()).status).toBe(409);
    expect((await list()).body).toEqual([]);
  });

  it('lets only a person read and answer requests, and only the helper wait', async () => {
    await take();
    const request = await opened();
    expect((await list(helper)).status).toBe(403);
    expect(await answer(request.id, { decision: 'allow' }, helper)).toMatchObject({
      status: 403,
      body: { error: { message: 'Only a person answers what Claude asks.' } },
    });
    expect((await wait(request.id, person)).status).toBe(403);
    expect((await list()).body[0]?.status).toBe('open');
  });

  it("answers 404 for another user's run and requests, every way", async () => {
    await take();
    const request = await opened();
    expect((await ask(permission(), other.helper)).status).toBe(404);
    expect((await list(other.person)).status).toBe(404);
    expect((await answer(request.id, { decision: 'allow' }, other.person)).status).toBe(404);
    expect((await wait(request.id, other.helper)).status).toBe(404);
    expect((await answer(randomUUID(), { decision: 'allow' })).status).toBe(404);
    expect((await list()).body[0]?.status).toBe('open');
  });

  it('lets only the first of two answers land', async () => {
    await take();
    const request = await opened();
    const [first, second] = await Promise.all([
      answer(request.id, { decision: 'allow' }),
      answer(request.id, { decision: 'deny' }),
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);
    const loser = first.status === 409 ? first : second;
    expect(loser.body).toEqual({
      error: { code: 'conflict', message: 'This was already answered.' },
    });
    const winner = first.status === 200 ? first : second;
    expect((await list()).body[0]?.decision).toBe(winner.body.decision);
  });

  it('ends the open requests of a cancelled run, waking a helper that waits', async () => {
    await take();
    const request = await opened();
    clock.advance(1);
    const answered = await opened(permission('Run ls'));
    await answer(answered.id, { decision: 'deny' });
    const waiting = wait(request.id);
    await person('POST', `/api/runs/${run.id}/cancel`);
    expect((await waiting).body).toMatchObject({ status: 'cancelled', endedAt: clock.now() });
    expect((await list()).body.map(({ status }) => status)).toEqual(['cancelled', 'answered']);
    expect(await answer(request.id, { decision: 'allow' })).toMatchObject({
      status: 409,
      body: { error: { message: 'Claude no longer waits for this.' } },
    });
  });

  it('ends a request nobody answered at its deadline, while the run goes on', async () => {
    await take();
    const request = await opened();
    clock.advance(RUN_REQUEST_DEADLINE_MS - 1);
    await checkIn();
    expect((await list()).body[0]?.status).toBe('open');
    clock.advance(1);
    // The helper keeps checking in while it waits, so its run never counts as silent.
    await checkIn();
    expect((await wait(request.id)).body).toMatchObject({
      status: 'expired',
      decision: null,
      endedAt: request.expiresAt,
    });
    expect(await answer(request.id, { decision: 'allow' })).toMatchObject({
      status: 409,
      body: { error: { message: 'Nobody answered in time, so Claude went on without it.' } },
    });
    expect((await person<Run>('GET', `/api/runs/${run.id}`)).body.status).toBe('running');
  });

  it('lets the helper that took the run end a request Claude no longer waits for', async () => {
    await take();
    const request = await opened();
    const cancel = (as = helper, runnerId = runner) =>
      as<RunRequest>('POST', `/api/requests/${request.id}/cancel`, { runnerId });
    expect((await cancel(person)).status).toBe(403);
    expect((await cancel(other.helper)).status).toBe(404);
    const otherRunner = randomUUID();
    await helper('PUT', `/api/runners/${otherRunner}`, helperName('A iMac'));
    expect(await cancel(helper, otherRunner)).toMatchObject({
      status: 403,
      body: { error: { message: 'Only the helper that took this run ends its requests.' } },
    });
    expect((await cancel()).body).toMatchObject({ status: 'cancelled', endedAt: clock.now() });
    expect((await list()).body[0]?.status).toBe('cancelled');
    expect(await answer(request.id, { decision: 'allow' })).toMatchObject({
      status: 409,
      body: { error: { message: 'Claude no longer waits for this.' } },
    });
    expect((await person<Run>('GET', `/api/runs/${run.id}`)).body.status).toBe('running');
  });

  it('ends an overdue request as expired, not cancelled, when the helper gives up on it', async () => {
    await take();
    const request = await opened();
    clock.advance(RUN_REQUEST_DEADLINE_MS);
    await checkIn();
    const cancelled = await helper<RunRequest>('POST', `/api/requests/${request.id}/cancel`, {
      runnerId: runner,
    });
    expect(cancelled.body).toMatchObject({ status: 'expired', endedAt: request.expiresAt });
  });

  it('keeps an answer that landed before the helper gave up', async () => {
    await take();
    const request = await opened();
    await answer(request.id, { decision: 'deny' });
    const cancelled = await helper<RunRequest>('POST', `/api/requests/${request.id}/cancel`, {
      runnerId: runner,
    });
    expect(cancelled.body).toMatchObject({ status: 'answered', decision: 'deny' });
  });

  it('refuses an answer that does not fit its request', async () => {
    await take();
    const request = await opened();
    expect(await answer(request.id, { decision: 'allow', answers: ['Yes'] })).toMatchObject({
      status: 400,
      body: { error: { message: 'Answer a permission with allow or deny alone.' } },
    });
    expect((await answer(request.id, { decision: 'sure' })).status).toBe(400);
    expect((await list()).body[0]?.status).toBe('open');
  });

  it('goes with its run', async () => {
    await take();
    await opened();
    await person('DELETE', '/api/tickets/MOB-1');
    const left = await api.db.selectFrom('runRequests').selectAll().execute();
    expect(left).toEqual([]);
  });
});
