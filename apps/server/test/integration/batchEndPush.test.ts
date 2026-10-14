import { randomUUID } from 'node:crypto';
import type { RunAllResult } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { fakePushService, newDevice, type Device } from '../helpers/push';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

describe.each(DIALECTS)('push when a Run all batch ends (%s)', (dialect) => {
  const service = fakePushService();
  const api = useTestServer(dialect, { push: { send: service.send } });
  const runner = randomUUID();
  let person: Caller;
  let helper: Caller;
  let device: Device;
  let batchId: string;

  const settle = () => new Promise((resolve) => setTimeout(resolve, 50));
  const submit = async (key: string) => {
    await helper('POST', `/api/tickets/${key}/claim`);
    await helper('POST', `/api/tickets/${key}/submit`, { summary: 'Fixed.' });
  };
  const finish = (status: string, error?: string) =>
    helper('POST', `/api/runs/${batchId}/finish`, { status, error });

  beforeEach(async () => {
    service.reset();
    const owner = await addUser(api.db, 'owner@example.com', Date.now());
    person = caller(() => api.app, owner.person);
    helper = caller(() => api.app, owner.helper);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    for (const title of ['Crash', 'Login', 'Search', 'Share']) {
      await person('POST', '/api/projects/MOB/tickets', { title });
    }
    await helper('PUT', `/api/runners/${runner}`, helperName('Mac'));
    device = newDevice();
    await person('PUT', '/api/push/subscription', device.subscription);
    const queued = await person<RunAllResult>('POST', '/api/projects/MOB/run-all', {
      runnerId: runner,
    });
    batchId = queued.body.runId as string;
    await helper('POST', `/api/runners/${runner}/next?kind=ticket&batches=1`);
  });

  it('pushes once, with how many were done and which were not, and opens Activity', async () => {
    await submit('MOB-1');
    await submit('MOB-3');
    expect((await finish('done')).status).toBe(200);

    expect(await service.messagesFor(device)).toEqual([
      {
        title: 'MOB: Run all finished: 2 of 4 done',
        body: 'Not finished: MOB-2, MOB-4',
        url: '/activity',
        tag: `batch:${batchId}`,
      },
    ]);
    await settle();
    expect(service.forDevice(device)).toHaveLength(1);
  });

  it('says a batch stopped and what it left, without its error', async () => {
    await submit('MOB-2');
    await finish('failed', 'fatal: password=hunter2pass rejected by db.internal');

    expect(await service.messagesFor(device)).toEqual([
      {
        title: 'MOB: Run all stopped: 1 of 4 done',
        body: 'Not finished: MOB-1, MOB-3, MOB-4',
        url: '/activity',
        tag: `batch:${batchId}`,
      },
    ]);
  });

  it('pushes nothing when the person cancels the batch', async () => {
    await person('POST', `/api/runs/${batchId}/cancel`);
    await settle();
    expect(service.forDevice(device)).toEqual([]);
  });
});
