import { randomUUID } from 'node:crypto';
import {
  RUN_REQUEST_DEADLINE_MS,
  type ProjectBoard,
  type Run,
  type RunRequest,
  type TicketListItem,
  type TicketsAcrossProjects,
} from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { testClock } from '../helpers/auth';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

const waitingKeys = (tickets: TicketListItem[]) =>
  tickets.filter((ticket) => ticket.waitingUntil !== null).map((ticket) => ticket.key);

describe.each(DIALECTS)('a ticket waiting for the person (%s)', (dialect) => {
  const clock = testClock();
  const api = useTestServer(dialect, { now: clock.now });
  const runner = randomUUID();
  let person: Caller;
  let helper: Caller;
  let other: Caller;
  let run: Run;

  const waiting = async (as = person) => [
    waitingKeys((await as<ProjectBoard>('GET', '/api/projects/MOB/board')).body.tickets),
    waitingKeys((await as<TicketListItem[]>('GET', '/api/projects/MOB/tickets')).body),
    waitingKeys((await as<TicketsAcrossProjects>('GET', '/api/tickets')).body.tickets),
  ];
  const nowhere = [[], [], []];
  const onMob1 = [['MOB-1'], ['MOB-1'], ['MOB-1']];
  const asks = async () =>
    (
      await helper<RunRequest>('POST', `/api/runs/${run.id}/requests`, {
        runnerId: runner,
        kind: 'permission',
        label: 'Run npm test',
        labelCut: false,
        questions: null,
      })
    ).body;

  beforeEach(async () => {
    clock.set(1_000_000);
    const owner = await addUser(api.db, 'owner@example.com', clock.now());
    const second = await addUser(api.db, 'second@example.com', clock.now());
    person = caller(() => api.app, owner.person);
    helper = caller(() => api.app, owner.helper);
    other = caller(() => api.app, second.person);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await person('POST', '/api/projects/MOB/tickets', { title: 'Crash' });
    await person('POST', '/api/projects/MOB/tickets', { title: 'Rename the queue' });
    await helper('PUT', `/api/runners/${runner}`, helperName('Dara’s MacBook'));
    await person('POST', '/api/tickets/MOB-1/runs', { runnerId: runner, prompt: 'Go' });
    run = (await helper<{ run: Run }>('POST', `/api/runners/${runner}/next?kind=ticket`)).body.run;
  });

  it('says so while Claude asks, and no longer once the person answers', async () => {
    expect(await waiting()).toEqual(nowhere);
    const request = await asks();
    expect(await waiting()).toEqual(onMob1);
    await person('POST', `/api/requests/${request.id}/answer`, { decision: 'deny' });
    expect(await waiting()).toEqual(nowhere);
  });

  it('says until the last open request runs out', async () => {
    const first = await asks();
    clock.advance(1_000);
    const second = await asks();
    const board = await person<ProjectBoard>('GET', '/api/projects/MOB/board');
    const until = Object.fromEntries(board.body.tickets.map((t) => [t.key, t.waitingUntil]));
    expect(until).toEqual({ 'MOB-1': second.expiresAt, 'MOB-2': null });
    expect(second.expiresAt).toBeGreaterThan(first.expiresAt);
  });

  it('says so only to the person whose run asks', async () => {
    await asks();
    expect((await other('GET', '/api/projects/MOB/board')).status).toBe(404);
    expect((await other<TicketsAcrossProjects>('GET', '/api/tickets')).body.tickets).toEqual([]);
    expect(await waiting(helper)).toEqual(onMob1);
  });

  it('no longer says so past the deadline, before anything settles the request', async () => {
    await asks();
    clock.advance(RUN_REQUEST_DEADLINE_MS - 1);
    await helper('PUT', `/api/runners/${runner}`, helperName('Dara’s MacBook'));
    expect(await waiting()).toEqual(onMob1);
    clock.advance(1);
    expect(await waiting()).toEqual(nowhere);
  });

  it('no longer says so once the request ends or the run does', async () => {
    const request = await asks();
    await helper('POST', `/api/requests/${request.id}/cancel`, { runnerId: runner });
    expect(await waiting()).toEqual(nowhere);
    await asks();
    expect(await waiting()).toEqual(onMob1);
    await person('POST', `/api/runs/${run.id}/cancel`);
    expect(await waiting()).toEqual(nowhere);
  });
});
