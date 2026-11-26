import type { PushKey } from '@tracker/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { testClock } from '../helpers/auth';
import { newDevice, fakePushService } from '../helpers/push';
import { addUser, caller, type Caller } from '../helpers/callers';
import { DIALECTS, useTestServer } from '../helpers/server';

const SUBSCRIPTION = '/api/push/subscription';

const READY = {
  title: 'MOB-1 is ready for you · 4/5',
  body: 'Fix the login button',
  url: '/p/MOB/1',
  tag: 'ticket:MOB-1',
};

describe.each(DIALECTS)('push notifications (%s)', (dialect) => {
  const clock = testClock();
  const service = fakePushService();
  const api = useTestServer(dialect, { now: clock.now, push: { send: service.send } });
  let person: Caller;
  let agent: Caller;
  let other: Caller;

  const subscribe = (as: Caller, device = newDevice()) =>
    as('PUT', SUBSCRIPTION, device.subscription).then((answer) => ({ answer, device }));
  const rows = () => api.db.selectFrom('pushSubscriptions').selectAll().execute();

  async function statusId(category: string): Promise<string> {
    const row = await api.db
      .selectFrom('statuses')
      .select('id')
      .where('category', '=', category as 'in_review')
      .executeTakeFirstOrThrow();

    return row.id;
  }

  // An agent's approval of a ticket in review sends the person a push.
  async function agentApproves(): Promise<void> {
    await api.db
      .updateTable('tickets')
      .set({ statusId: await statusId('in_review') })
      .execute();
    const approved = await agent('POST', '/api/tickets/MOB-1/review', {
      verdict: 'approved',
      rating: 4,
      summary: 'Good',
    });
    expect(approved.status).toBe(200);
  }

  beforeEach(async () => {
    service.reset();
    clock.set(1_000_000);
    const owner = await addUser(api.db, 'owner@example.com', clock.now());
    person = caller(() => api.app, owner.person);
    agent = caller(() => api.app, owner.agent);
    other = caller(() => api.app, (await addUser(api.db, 'sam@example.com', clock.now())).person);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await person('POST', '/api/projects/MOB/tickets', { title: 'Fix the login button' });
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
      expect((await subscribe(agent)).answer.status).toBe(403);
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

  describe('when an agent approves a ticket', () => {
    it('tells every device of the ticket’s user that it is ready, and nobody else', async () => {
      const { device: phone } = await subscribe(person);
      const { device: laptop } = await subscribe(person);
      const { device: sams } = await subscribe(other);
      await agentApproves();
      expect(await service.messagesFor(phone)).toEqual([READY]);
      expect(await service.messagesFor(laptop)).toEqual([READY]);
      expect(service.forDevice(sams)).toEqual([]);
      const headers = new Headers(service.sent[0]?.init.headers);
      expect(headers.get('content-encoding')).toBe('aes128gcm');
      expect(headers.get('authorization')).toMatch(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]{87}$/);
      expect(headers.get('ttl')).toBe('86400');
      expect(service.sent[0]?.init.redirect).toBe('error');
    });

    it('says nothing after changes asked or a person’s review', async () => {
      const { device } = await subscribe(person);
      const review = async (as: Caller, verdict: string) => {
        await agent('POST', '/api/tickets/MOB-1/claim');
        await agent('POST', '/api/tickets/MOB-1/submit', { summary: 'Done.' });

        return as('POST', '/api/tickets/MOB-1/review', { verdict, rating: 4, summary: 'Ok' });
      };

      expect((await review(agent, 'changes_requested')).status).toBe(200);
      expect((await review(person, 'approved')).status).toBe(200);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(service.forDevice(device)).toEqual([]);
      await agentApproves();
      expect(await service.messagesFor(device)).toEqual([READY]);
    });
  });

  describe('when a push service answers', () => {
    it('drops a device the push service says is gone', async () => {
      for (const status of [404, 410]) {
        service.reset();
        service.status = status;
        const { device } = await subscribe(person);
        await agentApproves();
        await vi.waitFor(async () => expect(await rows()).toHaveLength(0));
        expect(service.forDevice(device)).toHaveLength(1);
      }
    });

    it('keeps the device and only logs other failures', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      service.status = 500;
      await subscribe(person);
      await agentApproves();
      await vi.waitFor(() => expect(warn).toHaveBeenCalledWith(expect.stringMatching(/500/)));
      expect(String(warn.mock.calls[0]?.[0])).toContain('web.push.apple.com');
      expect(String(warn.mock.calls[0]?.[0])).not.toContain('/');
      expect(await rows()).toHaveLength(1);
      warn.mockRestore();
    });

    it('never holds up or fails the request that set it off', async () => {
      service.send.mockImplementation(() => new Promise(() => undefined));
      await subscribe(person);
      await agentApproves();
      service.send.mockImplementation(() => Promise.reject(new Error('offline')));
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      await agentApproves();
      await vi.waitFor(() => expect(warn).toHaveBeenCalled());
      warn.mockRestore();
    });
  });
});
