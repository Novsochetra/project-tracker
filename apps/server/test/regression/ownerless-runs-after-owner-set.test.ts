import { randomUUID } from 'node:crypto';
import type { Run, RunJob } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { createApiToken } from '../../src/auth/apiTokens';
import { findOwner } from '../../src/repositories/users';
import { addOwner, signIn } from '../helpers/auth';
import { caller, helperName } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

// Reviewer 139: runs and helpers made before the owner existed belonged to nobody who could sign
// in. The owner's next run on that ticket got 409 for a run they couldn't see or cancel, and the
// computer's helper could never check in again under its id.
describe.each(DIALECTS)('regression: runs from before the owner become theirs (%s)', (dialect) => {
  const api = useTestServer(dialect);

  it('lets the owner see, cancel and run again, and the helper check in again', async () => {
    const anyone = caller(() => api.app, {});
    const runner = randomUUID();
    await anyone('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await anyone('POST', '/api/projects/MOB/tickets', { title: 'Crash' });
    await anyone('PUT', `/api/runners/${runner}`, helperName('Mac'));
    const started = await anyone<Run>('POST', '/api/tickets/MOB-1/runs', {
      runnerId: runner,
      prompt: 'Go',
    });
    await anyone<RunJob>('POST', `/api/runners/${runner}/next`);

    await addOwner(api.db);
    const owner = await findOwner(api.db);
    const { secret } = await createApiToken(api.db, owner!.id, 'Mac', Date.now());
    const person = caller(() => api.app, { cookie: await signIn(api.app) });
    const helper = caller(() => api.app, { token: secret });

    const listed = await person<Run[]>('GET', '/api/tickets/MOB-1/runs');
    expect(listed.body.map((run) => run.id)).toEqual([started.body.id]);
    expect((await helper('PUT', `/api/runners/${runner}`, helperName('Mac'))).status).toBe(200);
    expect((await person('POST', `/api/runs/${started.body.id}/cancel`)).status).toBe(200);
    const again = await person('POST', '/api/tickets/MOB-1/runs', {
      runnerId: runner,
      prompt: 'Go',
    });
    expect(again.status).toBe(201);
  });
});
