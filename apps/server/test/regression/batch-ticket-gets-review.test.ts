import { randomUUID } from 'node:crypto';
import type { Run, RunAllResult } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

// PT-247: a ticket a Run all batch finished never got its automatic review, as only endRun chained.
describe.each(DIALECTS)('regression: a batch ticket gets its automatic review (%s)', (dialect) => {
  const api = useTestServer(dialect);
  let person: Caller;
  let helper: Caller;
  const runner = randomUUID();
  const runsOf = async (key: string) =>
    (await person<Run[]>('GET', `/api/tickets/${key}/runs`)).body;

  beforeEach(async () => {
    const user = await addUser(api.db, 'owner@example.com', Date.now());
    person = caller(() => api.app, user.person);
    helper = caller(() => api.app, user.helper);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await person('PATCH', '/api/projects/MOB', { autoReview: true });
    await person('POST', '/api/projects/MOB/tickets', { title: 'Crash' });
    await person('POST', '/api/projects/MOB/tickets', { title: 'Login' });
    await helper('PUT', `/api/runners/${runner}`, helperName('Mac'));
    await person<RunAllResult>('POST', '/api/projects/MOB/run-all', { runnerId: runner });
    await helper('POST', `/api/runners/${runner}/next?kind=ticket&batches=1`);
  });

  it('queues a review run when a sub agent submits its ticket', async () => {
    await helper('POST', '/api/tickets/MOB-1/claim');
    await helper('POST', '/api/tickets/MOB-1/submit', { summary: 'Fixed.' });

    const [review, held] = await runsOf('MOB-1');
    expect(held).toMatchObject({ status: 'done', batchId: expect.any(String) });
    expect(review).toMatchObject({ status: 'queued', role: 'review', batchId: null });
    expect(await runsOf('MOB-2')).toHaveLength(1);
  });

  it('queues no review when the person moves the ticket on themselves', async () => {
    const board = await person<{ statuses: { id: string; category: string }[] }>(
      'GET',
      '/api/projects/MOB/board',
    );
    const review = board.body.statuses.find(({ category }) => category === 'in_review');
    await person('PATCH', '/api/tickets/MOB-1', { statusId: review?.id });

    expect((await runsOf('MOB-1')).map(({ status }) => status)).toEqual(['done']);
  });

  it('queues no review in a project without automatic review', async () => {
    await person('PATCH', '/api/projects/MOB', { autoReview: false });
    await helper('POST', '/api/tickets/MOB-1/claim');
    await helper('POST', '/api/tickets/MOB-1/submit', { summary: 'Fixed.' });

    expect((await runsOf('MOB-1')).map(({ status }) => status)).toEqual(['done']);
  });
});
