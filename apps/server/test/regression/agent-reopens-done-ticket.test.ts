import type { ErrorBody, ProjectDetail, Ticket, TicketDetail } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { agent, statusOf } from '../helpers/fixtures';
import { addUser, caller, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

type Attempt = [method: string, path: string, body: unknown, refusal: ErrorBody];

const refused = (message: string): ErrorBody => ({ error: { code: 'forbidden', message } });
const LEAVE_REFUSED = refused(
  'MOB-1 is in Done. Move it out of Done only when the person tells you to, and then pass ' +
    'reopen: true (--reopen in the CLI).',
);
const SUBMIT_REFUSED = refused(
  'MOB-1 is in Done. Submit work on it only when the person tells you to, after you move it ' +
    'out of Done with reopen: true (--reopen in the CLI).',
);
const ENTER_REFUSED = refused('Only a person can move tickets to Done.');

interface Ids {
  todo: string;
  doing: string;
  done: string;
}

// PT-276: an agent token could move a ticket the person had put in Done back to To do or Need
// review (move, PATCH with a status, submit), since only the target status was checked. The
// owner's rule: an agent moves a ticket out of Done only when the person tells it to, and says so
// with reopen.
describe.each(DIALECTS)('regression: an agent moves a ticket out of Done (%s)', (dialect) => {
  const api = useTestServer(dialect);
  let person: Caller;
  let helper: Caller;
  let ids: Ids;

  const detail = async () => (await person<TicketDetail>('GET', '/api/tickets/MOB-1')).body;

  const moves = async () =>
    (await detail()).activity
      .filter((entry) => entry.type === 'event')
      .map((entry) => `${entry.actor.kind}: ${entry.text}`);

  const putInDone = () => person('PATCH', '/api/tickets/MOB-1', { statusId: ids.done });

  beforeEach(async () => {
    const owner = await addUser(api.db, 'owner@example.com', Date.now(), 'owner');
    person = caller(() => api.app, owner.person);
    helper = caller(() => api.app, owner.helper);
    const project = await person<ProjectDetail>('POST', '/api/projects', {
      name: 'Mobile',
      key: 'MOB',
    });
    ids = {
      todo: statusOf(project.body, 'todo').id,
      doing: statusOf(project.body, 'in_progress').id,
      done: statusOf(project.body, 'done').id,
    };
    await person('POST', '/api/projects/MOB/tickets', { title: 'Crash' });
    await putInDone();
  });

  it('refuses a move or a submit without reopen, and changes nothing', async () => {
    const before = await detail();
    const attempts: Attempt[] = [
      ['PATCH', '/api/tickets/MOB-1', { statusId: ids.todo }, LEAVE_REFUSED],
      ['PATCH', '/api/tickets/MOB-1', { statusId: ids.todo, reopen: false }, LEAVE_REFUSED],
      ['PATCH', '/api/tickets/MOB-1', { statusId: ids.doing, title: 'Fixed' }, LEAVE_REFUSED],
      ['POST', '/api/tickets/MOB-1/move', { statusId: ids.todo }, LEAVE_REFUSED],
      ['POST', '/api/tickets/MOB-1/move', { statusId: ids.doing, beforeId: null }, LEAVE_REFUSED],
      ['POST', '/api/tickets/MOB-1/submit', { summary: 'Fixed' }, SUBMIT_REFUSED],
    ];
    for (const [method, path, body, refusal] of attempts) {
      expect(await helper(method, path, body), `${method} ${path}`).toEqual({
        status: 403,
        body: refusal,
      });
    }

    expect(await detail()).toEqual(before);
  });

  it('moves it out when the agent says the person told it to, under its own name', async () => {
    const reopened = await helper<Ticket>('PATCH', '/api/tickets/MOB-1', {
      statusId: ids.todo,
      reopen: true,
    });
    expect(reopened.status).toBe(200);
    expect(reopened.body.statusId).toBe(ids.todo);

    await putInDone();
    const dragged = await helper<Ticket>('POST', '/api/tickets/MOB-1/move', {
      statusId: ids.doing,
      reopen: true,
    });
    expect(dragged.status).toBe(200);
    expect(dragged.body.statusId).toBe(ids.doing);

    expect(await moves()).toEqual([
      'human: created the ticket',
      'human: changed status to Done',
      'agent: changed status to To do',
      'human: changed status to Done',
      'agent: changed status to In progress',
    ]);
    expect((await detail()).activity.at(-1)?.actor).toEqual({ kind: 'agent', name: 'Agent' });
  });

  it('still never lets an agent move a ticket into Done, reopen or not', async () => {
    await helper('PATCH', '/api/tickets/MOB-1', { statusId: ids.todo, reopen: true });

    const into: Attempt[] = [
      ['PATCH', '/api/tickets/MOB-1', { statusId: ids.done, reopen: true }, ENTER_REFUSED],
      ['POST', '/api/tickets/MOB-1/move', { statusId: ids.done, reopen: true }, ENTER_REFUSED],
    ];
    for (const [method, path, body, refusal] of into) {
      expect(await helper(method, path, body), `${method} ${path}`).toEqual({
        status: 403,
        body: refusal,
      });
    }

    expect((await detail()).status.category).toBe('todo');
  });

  it('lets the person move it out and submit on it without reopen', async () => {
    const patched = await person('PATCH', '/api/tickets/MOB-1', { statusId: ids.todo });
    expect(patched.status).toBe(200);

    await putInDone();
    const dragged = await person('POST', '/api/tickets/MOB-1/move', { statusId: ids.doing });
    expect(dragged.status).toBe(200);

    await putInDone();
    const submitted = await person('POST', '/api/tickets/MOB-1/submit', { summary: 'Fixed' });
    expect(submitted.status).toBe(200);
    expect((await detail()).status.category).toBe('in_review');
  });
});

describe.each(DIALECTS)('regression: an agent reopens without an owner (%s)', (dialect) => {
  const api = useTestServer(dialect);

  it('refuses an agent that says so unless it passes reopen, and lets the person through', async () => {
    const person = api.client();
    const project = await person.createProject({ name: 'Mobile', key: 'MOB' });
    const [todo, done] = [statusOf(project, 'todo').id, statusOf(project, 'done').id];
    await person.createTicket('MOB', { title: 'Crash', statusId: done });

    const claude = api.client(agent());
    await expect(claude.updateTicket('MOB-1', { statusId: todo })).rejects.toMatchObject({
      status: 403,
      message: LEAVE_REFUSED.error.message,
    });
    await expect(claude.moveTicket('MOB-1', { statusId: todo })).rejects.toMatchObject({
      status: 403,
    });
    await expect(claude.submitForReview('MOB-1', { summary: 'Fixed' })).rejects.toMatchObject({
      status: 403,
      message: SUBMIT_REFUSED.error.message,
    });
    expect((await person.getTicket('MOB-1')).status.category).toBe('done');

    await expect(
      claude.updateTicket('MOB-1', { statusId: todo, reopen: true }),
    ).resolves.toMatchObject({ statusId: todo });
    await person.updateTicket('MOB-1', { statusId: done });
    await expect(person.moveTicket('MOB-1', { statusId: todo })).resolves.toMatchObject({
      statusId: todo,
    });
  });
});
