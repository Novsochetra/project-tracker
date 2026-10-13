import { randomUUID } from 'node:crypto';
import {
  RUN_REQUEST_DEADLINE_MS,
  type Run,
  type TicketDetail,
  type TicketQuestion,
} from '@tracker/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBroadcaster } from '../../src/events/broadcaster';
import type { RunNotice } from '../../src/events/runNotice';
import { testClock } from '../helpers/auth';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

const ASKED = { question: 'Which name should the setting have?', choices: ['Dark', 'Night'] };

describe.each(DIALECTS)('questions on a ticket (%s)', (dialect) => {
  const clock = testClock();
  const runEvents = createBroadcaster<RunNotice>();
  const api = useTestServer(dialect, { now: clock.now, runEvents });
  let person: Caller;
  let agent: Caller;
  let other: { person: Caller; agent: Caller };

  const ask = (body: unknown = ASKED, as = agent, key = 'MOB-1') =>
    as<TicketQuestion>('POST', `/api/tickets/${key}/questions`, body);
  const asked = async () => (await ask()).body;
  const list = (as = person) => as<TicketQuestion[]>('GET', '/api/tickets/MOB-1/questions');
  const answer = (id: string, body: unknown, as = person) =>
    as<TicketQuestion>('POST', `/api/questions/${id}/answer`, body);
  const wait = (id: string, as = agent) => as<TicketQuestion>('GET', `/api/questions/${id}/wait`);
  const events = async () =>
    (await person<TicketDetail>('GET', '/api/tickets/MOB-1')).body.activity
      .filter(({ type, text }) => type === 'event' && !text.startsWith('created'))
      .map(({ actor, text }) => `${actor.kind}: ${text}`);

  beforeEach(async () => {
    clock.set(Date.now());
    const a = await addUser(api.db, 'a@example.com', clock.now());
    const b = await addUser(api.db, 'b@example.com', clock.now() + 1);
    person = caller(() => api.app, a.person);
    agent = caller(() => api.app, a.helper);
    other = { person: caller(() => api.app, b.person), agent: caller(() => api.app, b.helper) };
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await person('POST', '/api/projects/MOB/tickets', { title: 'Dark mode' });
  });

  it('keeps what Claude asks and the answer the person gives, for Claude to read', async () => {
    const created = await ask();
    expect(created).toEqual({
      status: 201,
      body: {
        id: expect.any(String),
        ticketId: expect.any(String),
        runId: null,
        text: ASKED.question,
        choices: ASKED.choices,
        status: 'open',
        answer: null,
        createdAt: expect.any(Number),
        expiresAt: created.body.createdAt + RUN_REQUEST_DEADLINE_MS,
        endedAt: null,
      },
    });
    expect((await list()).body).toEqual([created.body]);
    clock.advance(1);
    const waiting = wait(created.body.id);
    await vi.waitFor(() => expect(api.broadcaster.listenerCount()).toBeGreaterThan(1));
    const answered = await answer(created.body.id, { answer: 'Night' });
    expect(answered.body).toMatchObject({ status: 'answered', answer: 'Night' });
    expect((await waiting).body).toEqual(answered.body);
    expect((await wait(created.body.id)).body).toEqual(answered.body);
    expect(await events()).toEqual([`agent: asked: ${ASKED.question}`, 'human: answered: Night']);
  });

  it('takes a question without choices and a skip', async () => {
    const question = (await ask({ question: 'Anything else?' })).body;
    expect(question.choices).toEqual([]);
    clock.advance(1);
    expect((await answer(question.id, { skip: true })).body).toMatchObject({
      status: 'skipped',
      answer: null,
    });
    expect((await events()).at(-1)).toBe('human: skipped the question: Anything else?');
  });

  it('refuses a question or an answer that does not fit', async () => {
    expect((await ask({ question: ' ' })).status).toBe(400);
    expect((await ask({ question: 'Which?', choices: ['A', 'a'] })).status).toBe(400);
    expect(
      (await ask({ question: 'Which?', choices: ['1', '2', '3', '4', '5', '6', '7'] })).status,
    ).toBe(400);
    const question = await asked();
    expect((await answer(question.id, { answer: '' })).status).toBe(400);
    expect((await answer(question.id, { answer: 'A', skip: true })).status).toBe(400);
    expect((await answer(question.id, { skip: false })).status).toBe(400);
    expect((await list()).body[0]?.status).toBe('open');
  });

  it('lets only a person answer', async () => {
    const question = await asked();
    expect(await answer(question.id, { answer: 'Dark' }, agent)).toMatchObject({
      status: 403,
      body: { error: { message: 'Only a person answers what Claude asks.' } },
    });
    expect((await list(agent)).body[0]?.status).toBe('open');
  });

  it('lets only the first of two answers land', async () => {
    const question = await asked();
    const [first, second] = await Promise.all([
      answer(question.id, { answer: 'Dark' }),
      answer(question.id, { skip: true }),
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);
    const loser = first.status === 409 ? first : second;
    expect(loser.body).toMatchObject({ error: { code: 'conflict' } });
    expect(await events()).toHaveLength(2);
  });

  it("answers 404 for another user's ticket and questions, every way", async () => {
    const question = await asked();
    expect((await ask(ASKED, other.agent)).status).toBe(404);
    expect((await list(other.person)).status).toBe(404);
    expect((await answer(question.id, { answer: 'Dark' }, other.person)).status).toBe(404);
    expect((await wait(question.id, other.agent)).status).toBe(404);
    expect((await other.agent('POST', `/api/questions/${question.id}/cancel`)).status).toBe(404);
    expect((await list()).body[0]?.status).toBe('open');
  });

  it('ends a question nobody answered at its deadline', async () => {
    const question = await asked();
    clock.advance(RUN_REQUEST_DEADLINE_MS - 1);
    expect((await list()).body[0]?.status).toBe('open');
    clock.advance(1);
    expect((await wait(question.id)).body).toMatchObject({
      status: 'expired',
      endedAt: question.expiresAt,
    });
    expect(await answer(question.id, { answer: 'Dark' })).toMatchObject({
      status: 409,
      body: { error: { message: 'Nobody answered in time, so Claude went on without it.' } },
    });
  });

  it('lets Claude end a question it no longer waits for, and keeps an answer that came first', async () => {
    const question = await asked();
    const cancel = (id: string) => agent<TicketQuestion>('POST', `/api/questions/${id}/cancel`);
    expect((await cancel(question.id)).body).toMatchObject({ status: 'cancelled' });
    expect(await answer(question.id, { answer: 'Dark' })).toMatchObject({
      status: 409,
      body: { error: { message: 'Claude no longer waits for this.' } },
    });
    clock.advance(1);
    const second = await asked();
    await answer(second.id, { answer: 'Night' });
    expect((await cancel(second.id)).body).toMatchObject({ status: 'answered', answer: 'Night' });
  });

  it('goes with its ticket', async () => {
    await asked();
    await person('DELETE', '/api/tickets/MOB-1');
    expect(await api.db.selectFrom('questions').selectAll().execute()).toEqual([]);
  });

  describe('in a run', () => {
    let runner: string;
    let run: Run;
    const checkIn = () => agent('PUT', `/api/runners/${runner}`, helperName('A Mac'));

    beforeEach(async () => {
      runner = randomUUID();
      await checkIn();
      run = (
        await person<Run>('POST', '/api/tickets/MOB-1/runs', { runnerId: runner, prompt: 'Go' })
      ).body;
    });

    it('belongs to the run that works on the ticket, and ends with it', async () => {
      expect((await asked()).runId).toBeNull();
      await agent('POST', `/api/runners/${runner}/next`);
      const question = await asked();
      expect(question.runId).toBe(run.id);
      const waiting = wait(question.id);
      await vi.waitFor(() => expect(runEvents.listenerCount()).toBe(1));
      await person('POST', `/api/runs/${run.id}/cancel`);
      expect((await waiting).body).toMatchObject({ status: 'cancelled' });
      expect(await answer(question.id, { answer: 'Dark' })).toMatchObject({
        status: 409,
        body: { error: { message: 'Claude no longer waits for this.' } },
      });
    });

    it('keeps a waiting run going while its helper checks in, past the question deadline', async () => {
      await agent('POST', `/api/runners/${runner}/next`);
      const question = await asked();
      for (let minutes = 0; minutes < 40; minutes += 10) {
        clock.advance(10 * 60_000);
        await checkIn();
        expect((await person<Run>('GET', `/api/runs/${run.id}`)).body.status).toBe('running');
      }
      expect((await wait(question.id)).body).toMatchObject({ status: 'expired' });
      expect((await person<Run>('GET', `/api/runs/${run.id}`)).body.status).toBe('running');
    });
  });
});
