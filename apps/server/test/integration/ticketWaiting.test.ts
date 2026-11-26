import {
  QUESTION_DEADLINE_MS,
  type ProjectBoard,
  type TicketListItem,
  type TicketQuestion,
  type TicketsAcrossProjects,
} from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { testClock } from '../helpers/auth';
import { addUser, caller, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

const waitingKeys = (tickets: TicketListItem[]) =>
  tickets.filter((ticket) => ticket.waitingUntil !== null).map((ticket) => ticket.key);

describe.each(DIALECTS)('a ticket waiting for the person (%s)', (dialect) => {
  const clock = testClock();
  const api = useTestServer(dialect, { now: clock.now });
  let person: Caller;
  let agent: Caller;
  let other: Caller;

  const waiting = async (as = person) => [
    waitingKeys((await as<ProjectBoard>('GET', '/api/projects/MOB/board')).body.tickets),
    waitingKeys((await as<TicketListItem[]>('GET', '/api/projects/MOB/tickets')).body),
    waitingKeys((await as<TicketsAcrossProjects>('GET', '/api/tickets')).body.tickets),
  ];
  const nowhere = [[], [], []];
  const onMob1 = [['MOB-1'], ['MOB-1'], ['MOB-1']];
  const asks = async () =>
    (
      await agent<TicketQuestion>('POST', '/api/tickets/MOB-1/questions', {
        question: 'Which name should the setting have?',
        choices: ['Dark', 'Night'],
      })
    ).body;

  beforeEach(async () => {
    clock.set(1_000_000);
    const owner = await addUser(api.db, 'owner@example.com', clock.now());
    const second = await addUser(api.db, 'second@example.com', clock.now());
    person = caller(() => api.app, owner.person);
    agent = caller(() => api.app, owner.helper);
    other = caller(() => api.app, second.person);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await person('POST', '/api/projects/MOB/tickets', { title: 'Crash' });
    await person('POST', '/api/projects/MOB/tickets', { title: 'Rename the queue' });
  });

  it('says so while an agent asks, and no longer once the person answers', async () => {
    expect(await waiting()).toEqual(nowhere);
    const question = await asks();
    expect(await waiting()).toEqual(onMob1);
    await person('POST', `/api/questions/${question.id}/answer`, { answer: 'Night' });
    expect(await waiting()).toEqual(nowhere);
  });

  it('says until the last open question runs out', async () => {
    const first = await asks();
    clock.advance(1_000);
    const second = await asks();
    const board = await person<ProjectBoard>('GET', '/api/projects/MOB/board');
    const until = Object.fromEntries(
      board.body.tickets.map((ticket) => [ticket.key, ticket.waitingUntil]),
    );
    expect(until).toEqual({ 'MOB-1': second.expiresAt, 'MOB-2': null });
    expect(second.expiresAt).toBeGreaterThan(first.expiresAt);
  });

  it('says so only to the person whose ticket it is', async () => {
    await asks();
    expect((await other('GET', '/api/projects/MOB/board')).status).toBe(404);
    expect((await other<TicketsAcrossProjects>('GET', '/api/tickets')).body.tickets).toEqual([]);
    expect(await waiting(agent)).toEqual(onMob1);
  });

  it('no longer says so past the deadline, before anything settles the question', async () => {
    await asks();
    clock.advance(QUESTION_DEADLINE_MS - 1);
    expect(await waiting()).toEqual(onMob1);
    clock.advance(1);
    expect(await waiting()).toEqual(nowhere);
  });

  it('no longer says so once the person skips it or the agent stops waiting', async () => {
    const skipped = await asks();
    await person('POST', `/api/questions/${skipped.id}/answer`, { skip: true });
    expect(await waiting()).toEqual(nowhere);
    const cancelled = await asks();
    expect(await waiting()).toEqual(onMob1);
    await agent('POST', `/api/questions/${cancelled.id}/cancel`);
    expect(await waiting()).toEqual(nowhere);
  });
});
