import type { TicketQuestion } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { testClock } from '../helpers/auth';
import { fakePushService, newDevice, type Device } from '../helpers/push';
import { addUser, caller, type Caller } from '../helpers/callers';
import { DIALECTS, useTestServer } from '../helpers/server';

// Claude's question can quote a secret it found, and a push shows on the lock screen.
const SECRET = 'postgres://admin:hunter2pass@db.internal:5432/app';
const QUESTION = { question: `Should I keep DATABASE_URL=${SECRET}?`, choices: ['Yes', 'No'] };

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

describe.each(DIALECTS)('push when Claude waits on the person (%s)', (dialect) => {
  const clock = testClock();
  const service = fakePushService();
  const api = useTestServer(dialect, { now: clock.now, push: { send: service.send } });
  let person: Caller;
  let agent: Caller;
  let phone: Device;
  let samPhone: Device;

  const subscribe = async (as: Caller) => {
    const device = newDevice();
    expect((await as('PUT', '/api/push/subscription', device.subscription)).status).toBe(204);

    return device;
  };

  beforeEach(async () => {
    service.reset();
    clock.set(Date.now());
    const owner = await addUser(api.db, 'owner@example.com', clock.now());
    const sam = await addUser(api.db, 'sam@example.com', clock.now() + 1);
    person = caller(() => api.app, owner.person);
    agent = caller(() => api.app, owner.agent);
    const samPerson = caller(() => api.app, sam.person);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    for (let num = 1; num <= 3; num += 1) {
      await person('POST', '/api/projects/MOB/tickets', { title: `Ticket ${num}` });
    }

    phone = await subscribe(person);
    samPhone = await subscribe(samPerson);
  });

  it('tells only the ticket’s user of a question, without the question, opening the ticket', async () => {
    const asked = await agent<TicketQuestion>('POST', '/api/tickets/MOB-3/questions', QUESTION);
    expect(asked.status).toBe(201);
    expect(await service.messagesFor(phone)).toEqual([
      {
        title: 'MOB-3: Claude has a question',
        body: 'Ticket 3 · Open the ticket to answer.',
        url: '/p/MOB/3',
        tag: 'ticket:MOB-3',
      },
    ]);
    expect(service.forDevice(samPhone)).toEqual([]);
  });

  it('says nothing for a question the person asked themselves', async () => {
    expect((await person('POST', '/api/tickets/MOB-3/questions', QUESTION)).status).toBe(201);
    await settle();
    expect(service.sent).toEqual([]);
  });
});
