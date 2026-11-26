import type { ErrorBody, TicketDetail } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { agent } from '../helpers/fixtures';
import { addUser, caller, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

type Attempt = [method: string, path: string, body: unknown, refusal: ErrorBody];

const refused = (message: string): ErrorBody => ({ error: { code: 'forbidden', message } });
const TICKET_REFUSED = refused('Only a person deletes a ticket.');
const ACTIVITY_REFUSED = refused('Only a person edits or deletes comments, reports and reviews.');

// PT-268: an API token could delete a ticket and edit or delete any comment, report or review, so
// an agent, or a prompt hidden in a ticket, could erase the person's work or the review of its work.
describe.each(DIALECTS)('regression: an agent deletes a ticket or its activity (%s)', (dialect) => {
  const api = useTestServer(dialect);
  let person: Caller;
  let helper: Caller;

  const entries = async () =>
    (await person<TicketDetail>('GET', '/api/tickets/MOB-1')).body.activity.filter(
      (entry) => entry.type !== 'event',
    );

  beforeEach(async () => {
    const owner = await addUser(api.db, 'owner@example.com', Date.now());
    person = caller(() => api.app, owner.person);
    helper = caller(() => api.app, owner.helper);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await person('POST', '/api/projects/MOB/tickets', { title: 'Crash' });
    await person('POST', '/api/tickets/MOB-1/comments', { text: 'Add a test first' });
    await helper('POST', '/api/tickets/MOB-1/submit', { summary: 'Fixed' });
    await helper('POST', '/api/tickets/MOB-1/review', {
      verdict: 'changes_requested',
      rating: 2,
      summary: 'No test',
    });
  });

  it('answers 403 to an agent token before the body or the id is read', async () => {
    const before = await entries();
    expect(before.map((entry) => entry.type)).toEqual(['comment', 'report', 'review']);

    const commentId = before[0]!.id;
    const attempts: Attempt[] = [
      ['DELETE', '/api/tickets/MOB-1', undefined, TICKET_REFUSED],
      ['DELETE', '/api/tickets/NOPE-1', undefined, TICKET_REFUSED],
      ['PATCH', `/api/activity/${commentId}`, { text: 'Ship it as it is' }, ACTIVITY_REFUSED],
      ['PATCH', `/api/activity/${commentId}`, { text: 7 }, ACTIVITY_REFUSED],
      ['PATCH', '/api/activity/missing', { text: 'Ship it' }, ACTIVITY_REFUSED],
      ['DELETE', '/api/activity/missing', undefined, ACTIVITY_REFUSED],
      ...before.map((entry): Attempt => [
        'DELETE',
        `/api/activity/${entry.id}`,
        undefined,
        ACTIVITY_REFUSED,
      ]),
    ];
    for (const [method, path, body, refusal] of attempts) {
      expect(await helper(method, path, body), `${method} ${path}`).toEqual({
        status: 403,
        body: refusal,
      });
    }

    expect(await entries()).toEqual(before);
  });

  it('lets the person edit a comment and delete each entry and the ticket', async () => {
    const [comment, report, review] = await entries();
    const edited = await person('PATCH', `/api/activity/${comment!.id}`, { text: 'Two tests' });
    expect(edited.status).toBe(200);

    for (const entry of [review!, report!, comment!]) {
      expect((await person('DELETE', `/api/activity/${entry.id}`)).status).toBe(204);
    }

    expect(await entries()).toEqual([]);
    expect((await person('DELETE', '/api/tickets/MOB-1')).status).toBe(204);
    expect((await person('GET', '/api/tickets/MOB-1')).status).toBe(404);
  });
});

describe.each(DIALECTS)('regression: an agent on a tracker without an owner (%s)', (dialect) => {
  const api = useTestServer(dialect);

  it('refuses an agent that says so, and lets the person through', async () => {
    const person = api.client();
    await person.createProject({ name: 'Mobile', key: 'MOB' });
    await person.createTicket('MOB', { title: 'Crash' });
    const comment = await person.addComment('MOB-1', { text: 'Add a test first' });

    const claude = api.client(agent());
    await expect(claude.updateComment(comment.id, { text: 'Ship it' })).rejects.toMatchObject({
      status: 403,
    });
    await expect(claude.deleteActivity(comment.id)).rejects.toMatchObject({ status: 403 });
    await expect(claude.deleteTicket('MOB-1')).rejects.toMatchObject({ status: 403 });
    expect((await person.getTicket('MOB-1')).activity.at(-1)?.text).toBe('Add a test first');

    expect((await person.updateComment(comment.id, { text: 'Two tests' })).text).toBe('Two tests');
    await expect(person.deleteActivity(comment.id)).resolves.toBeUndefined();
    await expect(person.deleteTicket('MOB-1')).resolves.toBeUndefined();
  });
});
