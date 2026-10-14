import { randomUUID } from 'node:crypto';
import type { PushKey, Run, RunJob } from '@tracker/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { testClock } from '../helpers/auth';
import { newDevice, fakePushService } from '../helpers/push';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

const SUBSCRIPTION = '/api/push/subscription';

describe.each(DIALECTS)('push notifications (%s)', (dialect) => {
  const clock = testClock();
  const service = fakePushService();
  const api = useTestServer(dialect, { now: clock.now, push: { send: service.send } });
  const runner = randomUUID();
  let person: Caller;
  let helper: Caller;
  let other: Caller;

  const subscribe = (as: Caller, device = newDevice()) =>
    as('PUT', SUBSCRIPTION, device.subscription).then((answer) => ({ answer, device }));
  const rows = () => api.db.selectFrom('pushSubscriptions').selectAll().execute();

  async function runEnds(body: object): Promise<void> {
    await person('POST', '/api/tickets/MOB-1/runs', { runnerId: runner, prompt: 'Fix it' });
    const job = await helper<RunJob>('POST', `/api/runners/${runner}/next?kind=ticket`);
    const ended = await helper<Run>('POST', `/api/runs/${job.body.run.id}/finish`, body);
    expect(ended.status).toBe(200);
  }

  beforeEach(async () => {
    service.reset();
    clock.set(1_000_000);
    const owner = await addUser(api.db, 'owner@example.com', clock.now());
    person = caller(() => api.app, owner.person);
    helper = caller(() => api.app, owner.helper);
    other = caller(() => api.app, (await addUser(api.db, 'sam@example.com', clock.now())).person);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await person('POST', '/api/projects/MOB/tickets', { title: 'Fix the login button' });
    await helper('PUT', `/api/runners/${runner}`, helperName('Mac'));
  });

  describe('keys and subscriptions', () => {
    it('makes one VAPID key pair and keeps it in the database', async () => {
      const first = await person<PushKey>('GET', '/api/push/key');
      expect(Buffer.from(first.body.publicKey, 'base64url')).toHaveLength(65);
      expect((await other<PushKey>('GET', '/api/push/key')).body).toEqual(first.body);
      const stored = await api.db.selectFrom('pushKeys').selectAll().execute();
      expect(stored.map((row) => row.publicKey)).toEqual([first.body.publicKey]);
    });

    it('saves a person’s device, and refuses agents and addresses of no push service', async () => {
      const { answer } = await subscribe(person);
      expect(answer.status).toBe(204);
      expect((await subscribe(helper)).answer.status).toBe(403);
      const elsewhere = newDevice();
      elsewhere.subscription.endpoint = 'https://postgres.railway.internal/x';
      expect((await subscribe(person, elsewhere)).answer.status).toBe(400);
      const shortKey = newDevice();
      shortKey.subscription.keys.auth = 'abc';
      expect((await subscribe(person, shortKey)).answer.status).toBe(400);
      expect(await rows()).toHaveLength(1);
    });

    it('gives a device saved again to the user who saved it last', async () => {
      const { device } = await subscribe(person);
      await subscribe(other, device);
      const [row] = await rows();
      expect(row?.endpoint).toBe(device.subscription.endpoint);
      expect((await rows()).length).toBe(1);
      expect((await person('DELETE', SUBSCRIPTION, { endpoint: row?.endpoint })).status).toBe(204);
      expect(await rows()).toHaveLength(1);
      await other('DELETE', SUBSCRIPTION, { endpoint: row?.endpoint });
      expect(await rows()).toHaveLength(0);
    });

    it('drops the device when its sign-in ends', async () => {
      await subscribe(person);
      await subscribe(other);
      expect((await person('DELETE', '/api/session')).status).toBe(200);
      expect(await rows()).toHaveLength(1);
    });
  });

  describe('when Claude is done', () => {
    it('tells every device of the run’s user that a ticket run finished, and nobody else', async () => {
      const { device: phone } = await subscribe(person);
      const { device: laptop } = await subscribe(person);
      const { device: sams } = await subscribe(other);
      await runEnds({ status: 'done' });
      const message = {
        title: 'MOB-1: Claude finished',
        body: 'Fix the login button',
        url: '/p/MOB/1',
        tag: 'ticket:MOB-1',
      };
      expect(await service.messagesFor(phone)).toEqual([message]);
      expect(await service.messagesFor(laptop)).toEqual([message]);
      expect(service.forDevice(sams)).toEqual([]);
      const headers = new Headers(service.sent[0]?.init.headers);
      expect(headers.get('content-encoding')).toBe('aes128gcm');
      expect(headers.get('authorization')).toMatch(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]{87}$/);
      expect(headers.get('ttl')).toBe('86400');
      expect(service.sent[0]?.init.redirect).toBe('error');
    });

    it('says why a run stopped, and nothing for a run the person cancelled', async () => {
      const { device } = await subscribe(person);
      await runEnds({ status: 'failed', error: 'Claude Code exited with code 1.' });
      expect((await service.messagesFor(device))[0]?.title).toBe(
        'MOB-1: Claude stopped: Claude Code exited with code 1.',
      );
      await person('POST', '/api/tickets/MOB-1/runs', { runnerId: runner, prompt: 'Again' });
      const runs = await person<Run[]>('GET', '/api/tickets/MOB-1/runs');
      await person('POST', `/api/runs/${runs.body[0]?.id}/cancel`);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(service.forDevice(device)).toHaveLength(1);
    });

    it('says a ticket an agent approved is ready, but not after changes asked or a person’s review', async () => {
      const { device } = await subscribe(person);
      const review = async (as: Caller, verdict: string) => {
        await helper('POST', '/api/tickets/MOB-1/claim');
        await helper('POST', '/api/tickets/MOB-1/submit', { summary: 'Done.' });
        return as('POST', '/api/tickets/MOB-1/review', { verdict, rating: 4, summary: 'Ok' });
      };
      expect((await review(helper, 'changes_requested')).status).toBe(200);
      expect((await review(person, 'approved')).status).toBe(200);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(service.forDevice(device)).toEqual([]);
      await api.db
        .updateTable('tickets')
        .set({ statusId: await statusId('in_review') })
        .execute();
      await helper('POST', '/api/tickets/MOB-1/review', {
        verdict: 'approved',
        rating: 4,
        summary: 'Good',
      });
      expect(await service.messagesFor(device)).toEqual([
        {
          title: 'MOB-1 is ready for you · 4/5',
          body: 'Fix the login button',
          url: '/p/MOB/1',
          tag: 'ticket:MOB-1',
        },
      ]);
    });
  });

  async function statusId(category: string): Promise<string> {
    const row = await api.db
      .selectFrom('statuses')
      .select('id')
      .where('category', '=', category as 'in_review')
      .executeTakeFirstOrThrow();
    return row.id;
  }

  describe('when a push service answers', () => {
    it('drops a device the push service says is gone', async () => {
      for (const status of [404, 410]) {
        service.reset();
        service.status = status;
        const { device } = await subscribe(person);
        await runEnds({ status: 'done' });
        await vi.waitFor(async () => expect(await rows()).toHaveLength(0));
        expect(service.forDevice(device)).toHaveLength(1);
      }
    });

    it('keeps the device and only logs other failures', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      service.status = 500;
      await subscribe(person);
      await runEnds({ status: 'done' });
      await vi.waitFor(() => expect(warn).toHaveBeenCalledWith(expect.stringMatching(/500/)));
      expect(String(warn.mock.calls[0]?.[0])).toContain('web.push.apple.com');
      expect(String(warn.mock.calls[0]?.[0])).not.toContain('/');
      expect(await rows()).toHaveLength(1);
      warn.mockRestore();
    });

    it('never holds up or fails the request that set it off', async () => {
      service.send.mockImplementation(() => new Promise(() => undefined));
      await subscribe(person);
      await runEnds({ status: 'done' });
      service.send.mockImplementation(() => Promise.reject(new Error('offline')));
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      await runEnds({ status: 'done' });
      await vi.waitFor(() => expect(warn).toHaveBeenCalled());
      warn.mockRestore();
    });
  });
});
