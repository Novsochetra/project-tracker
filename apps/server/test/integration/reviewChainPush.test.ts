import { randomUUID } from 'node:crypto';
import type { ProjectDetail, Run, RunJob } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { testClock } from '../helpers/auth';
import { fakePushService, newDevice, type Device } from '../helpers/push';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

describe.each(DIALECTS)('push when the automatic review stops (%s)', (dialect) => {
  const clock = testClock();
  const service = fakePushService();
  const api = useTestServer(dialect, { now: clock.now, push: { send: service.send } });
  const runner = randomUUID();
  let person: Caller;
  let helper: Caller;
  let device: Device;

  const take = async () =>
    (await helper<RunJob>('POST', `/api/runners/${runner}/next?kind=ticket`)).body;
  const finish = (job: RunJob) =>
    helper<Run>('POST', `/api/runs/${job.run.id}/finish`, { status: 'done' });
  const submit = () => helper('POST', '/api/tickets/MOB-1/submit', { summary: 'Fixed.' });
  const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

  beforeEach(async () => {
    service.reset();
    clock.set(1_000_000);
    const owner = await addUser(api.db, 'owner@example.com', clock.now());
    person = caller(() => api.app, owner.person);
    helper = caller(() => api.app, owner.helper);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await person('PATCH', '/api/projects/MOB', { autoReview: true });
    await person('POST', '/api/projects/MOB/tickets', { title: 'Fix the login button' });
    await helper('PUT', `/api/runners/${runner}`, helperName('Mac'));
    device = newDevice();
    await person('PUT', '/api/push/subscription', device.subscription);
    await person('POST', '/api/tickets/MOB-1/runs', { runnerId: runner, prompt: 'Fix it' });
  });

  it('says why under the ticket’s tag, in place of "Claude finished"', async () => {
    const job = await take();
    const { body } = await person<ProjectDetail>('GET', '/api/projects/MOB');
    const done = body.statuses.find((status) => status.category === 'done');
    await person('POST', '/api/tickets/MOB-1/move', { statusId: done?.id });
    await submit();
    expect((await finish(job)).status).toBe(200);

    expect(await service.messagesFor(device)).toEqual([
      {
        title: 'MOB-1: Automatic review stopped',
        body: 'You moved the ticket.',
        url: '/p/MOB/1',
        tag: 'ticket:MOB-1',
      },
    ]);
    await settle();
    expect(service.forDevice(device)).toHaveLength(1);
  });

  it('pushes nothing while the chain goes on to the review', async () => {
    const job = await take();
    await submit();
    await finish(job);
    expect((await take()).run.role).toBe('review');
    await settle();
    expect(service.forDevice(device)).toEqual([]);
  });
});
