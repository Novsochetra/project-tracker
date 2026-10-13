import { randomUUID } from 'node:crypto';
import { RUNNER_ONLINE_MS, type Run, type RunJob } from '@tracker/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { testClock } from '../helpers/auth';
import { addUser, caller, helperName } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

vi.mock('../../src/repositories/runChain', () => ({
  markChainStop: () => Promise.reject(new Error('The database went away.')),
}));

// PT-192 review: a chain step that threw made the helper's finish fail, though the run had ended.
describe.each(DIALECTS)('regression: a failed chain step keeps the finish (%s)', (dialect) => {
  const clock = testClock();
  const api = useTestServer(dialect, { now: clock.now });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('answers the finish with the ended run and logs why the chain went no further', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const user = await addUser(api.db, 'owner@example.com', clock.now());
    const person = caller(() => api.app, user.person);
    const helper = caller(() => api.app, user.helper);
    const runner = randomUUID();
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await person('PATCH', '/api/projects/MOB', { autoReview: true });
    await person('POST', '/api/projects/MOB/tickets', { title: 'Crash' });
    await helper('PUT', `/api/runners/${runner}`, helperName('Mac'));
    await person('POST', '/api/tickets/MOB-1/runs', { runnerId: runner, prompt: 'Go' });
    const job = await helper<RunJob>('POST', `/api/runners/${runner}/next`);
    await helper('POST', '/api/tickets/MOB-1/submit', { summary: 'Fixed.' });
    clock.advance(RUNNER_ONLINE_MS);

    const finished = await helper<Run>('POST', `/api/runs/${job.body.run.id}/finish`, {
      status: 'done',
    });
    expect(finished.status).toBe(200);
    expect(finished.body.status).toBe('done');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('The database went away.'));
  });
});
