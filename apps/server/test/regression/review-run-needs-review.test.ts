import { randomUUID } from 'node:crypto';
import type { ProjectDetail, Run } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { addUser, caller, helperName } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

// PT-193 review: a review run on a To do ticket was queued (201), and a reviewer then had nothing
// to review.
describe.each(DIALECTS)('regression: a review run needs a ticket in review (%s)', (dialect) => {
  const api = useTestServer(dialect);

  it('answers 409 for a ticket that is not waiting for review, and queues one that is', async () => {
    const user = await addUser(api.db, 'owner@example.com', Date.now());
    const person = caller(() => api.app, user.person);
    const helper = caller(() => api.app, user.helper);
    const runner = randomUUID();
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await person('POST', '/api/projects/MOB/tickets', { title: 'Crash' });
    await helper('PUT', `/api/runners/${runner}`, helperName('Mac'));
    const review = () =>
      person<Run>('POST', '/api/tickets/MOB-1/runs', {
        runnerId: runner,
        prompt: 'Review',
        role: 'review',
      });

    const refused = await review();
    expect(refused.status).toBe(409);
    expect(refused.body).toMatchObject({ error: { message: "MOB-1 isn't waiting for review." } });
    expect(await api.db.selectFrom('runs').selectAll().execute()).toEqual([]);

    const { body } = await person<ProjectDetail>('GET', '/api/projects/MOB');
    const inReview = body.statuses.find((status) => status.category === 'in_review');
    await person('POST', '/api/tickets/MOB-1/move', { statusId: inReview?.id });
    expect((await review()).status).toBe(201);
  });
});
