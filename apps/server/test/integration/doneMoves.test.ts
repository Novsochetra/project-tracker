import {
  DONE_MOVE_MAX,
  TOO_MANY_DONE_MOVES,
  type ErrorBody,
  type ProjectDetail,
  type StatusCategory,
  type TicketDetail,
  type TicketMoves,
  type TicketPlaceInput,
} from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { agent, eventTexts, statusOf } from '../helpers/fixtures';
import { addUser, caller, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer, type RequestOptions } from '../helpers/server';

const MOVE_REFUSED = { code: 'forbidden', message: 'Only a person can move tickets to Done.' };
const UNDO_REFUSED = { code: 'forbidden', message: 'Only a person undoes a move to Done.' };

const undoOf = (moves: TicketMoves): TicketPlaceInput[] =>
  moves.moved.map(({ key, from }) => ({ key, ...from }));

describe.each(DIALECTS)('moving tickets to Done in one step (%s)', (dialect) => {
  const api = useTestServer(dialect);
  let mobile: ProjectDetail;
  let website: ProjectDetail;

  const statusId = (project: ProjectDetail, category: StatusCategory) =>
    statusOf(project, category).id;

  const create = (project: ProjectDetail, title: string, category: StatusCategory = 'reviewed') =>
    api
      .client()
      .createTicket(project.project.key, { title, statusId: statusId(project, category) });

  async function places(projectKey: string) {
    const board = await api.client().getBoard(projectKey);

    return Object.fromEntries(
      board.statuses.map((status) => [
        status.name,
        board.tickets
          .filter((ticket) => ticket.statusId === status.id)
          .map((ticket) => `${ticket.key}@${ticket.rank}`),
      ]),
    );
  }

  const keysIn = async (projectKey: string, statusName: string) =>
    ((await places(projectKey))[statusName] ?? []).map((place) => place.split('@')[0]);

  const moveToDone = (keys: unknown, options?: RequestOptions) =>
    api.post<TicketMoves>('/api/tickets/done', { keys }, options);

  beforeEach(async () => {
    mobile = await api.client().createProject({ name: 'Mobile app', key: 'MOB' });
    website = await api.client().createProject({ name: 'Website', key: 'WEB' });
  });

  it("moves each ticket to its own project's first done status, as the status menu does", async () => {
    await api.client().updateStatus(statusId(website, 'done'), { name: 'Shipped' });
    await api.client().createStatus('WEB', { name: 'Archived', category: 'done' });
    await create(mobile, 'Cache avatars');
    await create(website, 'Hero copy');
    api.events.length = 0;

    const res = await moveToDone(['WEB-1', 'MOB-1']);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      moved: [
        { key: 'WEB-1', from: { statusId: statusId(website, 'reviewed'), rank: 0 } },
        { key: 'MOB-1', from: { statusId: statusId(mobile, 'reviewed'), rank: 0 } },
      ],
      skipped: [],
    });
    const web = await api.client().getTicket('WEB-1');
    expect(web.status.name).toBe('Shipped');
    expect(web.activity.at(-1)).toMatchObject({
      type: 'event',
      text: 'changed status to Shipped',
      actor: { kind: 'human' },
    });
    const mob = await api.client().getTicket('MOB-1');
    expect(mob.status.category).toBe('done');
    expect(eventTexts(mob).at(-1)).toBe('changed status to Done');
    expect(api.events).toEqual([{ type: 'changed', projectId: null, ticketId: null }]);
  });

  it("sends one change event naming the project when they're all in one", async () => {
    for (const title of ['One', 'Two', 'Three']) await create(mobile, title);
    api.events.length = 0;

    await moveToDone(['MOB-1', 'MOB-2', 'MOB-3']);

    expect(await keysIn('MOB', 'Reviewed')).toEqual([]);
    expect(api.events).toEqual([{ type: 'changed', projectId: mobile.project.id, ticketId: null }]);
  });

  it('puts them on top of Done in the order they stood in, above the tickets done before', async () => {
    await create(mobile, 'Shipped last week', 'done');
    for (const title of ['Two', 'Three', 'Four']) await create(mobile, title);
    expect(await keysIn('MOB', 'Reviewed')).toEqual(['MOB-4', 'MOB-3', 'MOB-2']);

    await moveToDone(['MOB-2', 'MOB-4', 'MOB-3']);

    expect(await keysIn('MOB', 'Done')).toEqual(['MOB-4', 'MOB-3', 'MOB-2', 'MOB-1']);
  });

  it('skips keys that name no ticket, tickets already done and a project without Done', async () => {
    await create(mobile, 'Reviewed');
    await create(mobile, 'Done already', 'done');
    await create(website, 'Nowhere to go');
    await api.client().deleteStatus(statusId(website, 'done'));
    const done = await api.client().getTicket('MOB-2');
    api.events.length = 0;

    const res = await moveToDone([
      'mob-1',
      'MOB-01',
      'MOB-2',
      'MOB-99',
      'NOPE-1',
      'not a key',
      'WEB-1',
    ]);

    expect(res.body).toEqual({
      moved: [{ key: 'MOB-1', from: { statusId: statusId(mobile, 'reviewed'), rank: 0 } }],
      skipped: ['MOB-2', 'MOB-99', 'NOPE-1', 'not a key', 'WEB-1'],
    });
    const stayed = await api.client().getTicket('MOB-2');
    expect([stayed.ticket, stayed.activity]).toEqual([done.ticket, done.activity]);
    expect((await api.client().getTicket('WEB-1')).status.category).toBe('reviewed');
    expect(eventTexts(await api.client().getTicket('MOB-1'))).toEqual([
      'created the ticket',
      'changed status to Done',
    ]);
    expect(api.events).toEqual([{ type: 'changed', projectId: mobile.project.id, ticketId: null }]);
  });

  it('changes nothing and sends no event when every key is skipped', async () => {
    await create(mobile, 'Done already', 'done');
    api.events.length = 0;

    const res = await moveToDone(['MOB-1', 'MOB-7']);

    expect(res).toMatchObject({ status: 200, body: { moved: [], skipped: ['MOB-1', 'MOB-7'] } });
    expect(api.events).toEqual([]);
  });

  it(`takes up to ${DONE_MOVE_MAX} keys and refuses more, none, or a key too long`, async () => {
    await create(mobile, 'The only one');
    const keys = Array.from({ length: DONE_MOVE_MAX }, (_, index) => `MOB-${index + 1}`);

    const most = await moveToDone(keys);
    expect(most.body.moved.map(({ key }) => key)).toEqual(['MOB-1']);
    expect(most.body.skipped).toHaveLength(DONE_MOVE_MAX - 1);

    const tooMany = await api.post<ErrorBody>('/api/tickets/done', { keys: [...keys, 'MOB-501'] });
    expect(tooMany).toMatchObject({
      status: 400,
      body: { error: { code: 'invalid_input', message: TOO_MANY_DONE_MOVES } },
    });
    for (const body of [{ keys: [] }, {}, { keys: [`MOB-${'1'.repeat(40)}`] }]) {
      expect((await api.post('/api/tickets/done', body)).status).toBe(400);
    }

    const undo = keys.map((key) => ({ key, statusId: 's1', rank: 0 }));
    expect((await api.post('/api/tickets/done/undo', { tickets: undo })).status).toBe(200);
    const tooManyBack = await api.post<ErrorBody>('/api/tickets/done/undo', {
      tickets: [...undo, { key: 'MOB-501', statusId: 's1', rank: 0 }],
    });
    expect(tooManyBack.body.error.message).toBe(TOO_MANY_DONE_MOVES);
    for (const tickets of [[], [{ key: 'MOB-1', statusId: 's1', rank: 0.5 }]]) {
      expect((await api.post('/api/tickets/done/undo', { tickets })).status).toBe(400);
    }
  });

  it('refuses agents before reading the body and moves nothing', async () => {
    await create(mobile, 'Approved work');
    api.events.length = 0;
    const worker = { actor: agent('Worker') };

    expect(await moveToDone(['MOB-1'], worker)).toMatchObject({
      status: 403,
      body: { error: MOVE_REFUSED },
    });
    expect((await moveToDone(7, worker)).status).toBe(403);
    const undo = [{ key: 'MOB-1', statusId: statusId(mobile, 'todo'), rank: 0 }];
    expect(await api.post('/api/tickets/done/undo', { tickets: undo }, worker)).toMatchObject({
      status: 403,
      body: { error: UNDO_REFUSED },
    });
    expect((await api.post('/api/tickets/done/undo', { tickets: 7 }, worker)).status).toBe(403);
    expect((await api.client().getTicket('MOB-1')).status.category).toBe('reviewed');
    expect(api.events).toEqual([]);
  });

  it('puts every ticket back in its own status and place with one undo', async () => {
    const qa = await api.client().createStatus('MOB', { name: 'QA passed', category: 'reviewed' });
    for (const title of ['One', 'Two', 'Three', 'Four']) await create(mobile, title);
    await api.client().createTicket('MOB', { title: 'Five', statusId: qa.id });
    await create(website, 'Hero copy');
    const before = { mobile: await places('MOB'), website: await places('WEB') };
    expect(before.mobile.Reviewed).toEqual([
      'MOB-4@-3000',
      'MOB-3@-2000',
      'MOB-2@-1000',
      'MOB-1@0',
    ]);

    const moves = await api.client().moveToDone(['MOB-4', 'MOB-1', 'MOB-5', 'WEB-1', 'MOB-3']);
    expect(await keysIn('MOB', 'Reviewed')).toEqual(['MOB-2']);
    api.events.length = 0;

    const res = await api.post<TicketMoves>('/api/tickets/done/undo', { tickets: undoOf(moves) });

    expect(res.status).toBe(200);
    expect(res.body.moved.map(({ key }) => key)).toEqual([
      'MOB-4',
      'MOB-1',
      'MOB-5',
      'WEB-1',
      'MOB-3',
    ]);
    expect(res.body.moved[0]?.from.statusId).toBe(statusId(mobile, 'done'));
    expect(res.body.skipped).toEqual([]);
    expect({ mobile: await places('MOB'), website: await places('WEB') }).toEqual(before);
    expect(eventTexts(await api.client().getTicket('MOB-5')).slice(1)).toEqual([
      'changed status to Done',
      'changed status to QA passed',
    ]);
    expect((await api.client().getTicket('MOB-4')).activity.at(-1)).toMatchObject({
      text: 'changed status to Reviewed',
      actor: { kind: 'human' },
    });
    expect(api.events).toEqual([{ type: 'changed', projectId: null, ticketId: null }]);
  });

  it('puts them back one at a time in the order given, so a list by update keeps its order', async () => {
    for (const title of ['One', 'Two', 'Three']) await create(mobile, title);
    await create(website, 'Hero copy');
    const ready = async () =>
      (await api.client().listAllTickets({ category: 'reviewed' })).tickets.map(({ key }) => key);
    const before = await ready();

    const moves = await api.client().moveToDone(before);
    await api.client().undoMoveToDone(undoOf(moves).reverse());

    expect(await ready()).toEqual(before);
  });

  it('leaves a ticket that moved on since, and puts nothing into a done status', async () => {
    for (const title of ['One', 'Two', 'Three', 'Four']) await create(mobile, title);
    await api.client().moveToDone(['MOB-1', 'MOB-2', 'MOB-3', 'MOB-4']);
    await api.client().updateTicket('MOB-2', { statusId: statusId(mobile, 'in_progress') });
    const reviewed = statusId(mobile, 'reviewed');

    const res = await api.client().undoMoveToDone([
      { key: 'MOB-1', statusId: reviewed, rank: 0 },
      { key: 'MOB-2', statusId: reviewed, rank: -1000 },
      { key: 'MOB-3', statusId: statusId(mobile, 'done'), rank: 5000 },
      { key: 'MOB-4', statusId: statusId(website, 'reviewed'), rank: -3000 },
      { key: 'MOB-9', statusId: reviewed, rank: 0 },
    ]);

    expect(res).toEqual({
      moved: [{ key: 'MOB-1', from: { statusId: statusId(mobile, 'done'), rank: 0 } }],
      skipped: ['MOB-2', 'MOB-3', 'MOB-4', 'MOB-9'],
    });
    expect(await keysIn('MOB', 'Reviewed')).toEqual(['MOB-1']);
    expect(await keysIn('MOB', 'In progress')).toEqual(['MOB-2']);
    expect(await keysIn('MOB', 'Done')).toEqual(['MOB-4', 'MOB-3']);
  });
});

describe.each(DIALECTS)('whose tickets move to Done (%s)', (dialect) => {
  const api = useTestServer(dialect);
  let owner: { person: Caller; helper: Caller };
  let invited: Caller;

  const category = async (who: Caller, key: string) =>
    (await who<TicketDetail>('GET', `/api/tickets/${key}`)).body.status.category;

  beforeEach(async () => {
    const first = await addUser(api.db, 'a@example.com', Date.now(), 'owner');
    const second = await addUser(api.db, 'b@example.com', Date.now() + 1);
    owner = {
      person: caller(() => api.app, first.person),
      helper: caller(() => api.app, first.helper),
    };
    invited = caller(() => api.app, second.person);
    for (const [who, name, key] of [
      [owner.person, 'Mobile', 'MOB'],
      [invited, 'Website', 'WEB'],
    ] as const) {
      const project = await who<ProjectDetail>('POST', '/api/projects', { name, key });
      const reviewed = statusOf(project.body, 'reviewed').id;
      await who('POST', `/api/projects/${key}/tickets`, { title: 'Approved', statusId: reviewed });
    }
  });

  it("skips another user's ticket as if it didn't exist", async () => {
    const res = await invited<TicketMoves>('POST', '/api/tickets/done', {
      keys: ['MOB-1', 'WEB-1'],
    });

    expect(res.body).toEqual({
      moved: [expect.objectContaining({ key: 'WEB-1' })],
      skipped: ['MOB-1'],
    });
    expect(await category(owner.person, 'MOB-1')).toBe('reviewed');
    const moves = await owner.person<TicketMoves>('POST', '/api/tickets/done', { keys: ['MOB-1'] });
    const undo = await invited<TicketMoves>('POST', '/api/tickets/done/undo', {
      tickets: undoOf(moves.body),
    });
    expect(undo.body).toEqual({ moved: [], skipped: ['MOB-1'] });
    expect(await category(owner.person, 'MOB-1')).toBe('done');
  });

  it("refuses the owner's agent token both ways", async () => {
    const move = await owner.helper<ErrorBody>('POST', '/api/tickets/done', { keys: ['MOB-1'] });
    expect(move).toEqual({ status: 403, body: { error: MOVE_REFUSED } });
    const moves = await owner.person<TicketMoves>('POST', '/api/tickets/done', { keys: ['MOB-1'] });
    const undo = await owner.helper<ErrorBody>('POST', '/api/tickets/done/undo', {
      tickets: undoOf(moves.body),
    });
    expect(undo).toEqual({ status: 403, body: { error: UNDO_REFUSED } });
    expect(await category(owner.person, 'MOB-1')).toBe('done');
  });
});
