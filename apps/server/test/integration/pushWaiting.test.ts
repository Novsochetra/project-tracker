import { randomUUID } from 'node:crypto';
import type {
  AddRunRequestInput,
  ChatDetail,
  PushMessage,
  RunJob,
  RunRequest,
  TicketQuestion,
} from '@tracker/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServiceContext } from '../../src/services/context';
import { pushRunRequest } from '../../src/services/runRequestPush';
import { findRunInScope } from '../../src/repositories/runs';
import { findRunRequestRow } from '../../src/repositories/runRequests';
import { testClock } from '../helpers/auth';
import { fakePushService, newDevice, type Device } from '../helpers/push';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

// Claude's question can quote a secret it found, and a push shows on the lock screen.
const SECRET = 'postgres://admin:hunter2pass@db.internal:5432/app';
const QUESTION = { question: `Should I keep DATABASE_URL=${SECRET}?`, choices: ['Yes', 'No'] };

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

describe.each(DIALECTS)('push when Claude waits on the person (%s)', (dialect) => {
  const clock = testClock();
  const service = fakePushService();
  const api = useTestServer(dialect, { now: clock.now, push: { send: service.send } });
  const runner = randomUUID();
  let ownerId: string;
  let person: Caller;
  let agent: Caller;
  let phone: Device;
  let samPhone: Device;

  const subscribe = async (as: Caller) => {
    const device = newDevice();
    expect((await as('PUT', '/api/push/subscription', device.subscription)).status).toBe(204);
    return device;
  };

  const request = (
    runId: string,
    label: string,
    kind: 'permission' | 'question' = 'permission',
  ) => {
    const questions = [
      { question: label, header: 'Name', options: [], multiSelect: false },
    ] satisfies AddRunRequestInput['questions'];
    const input: AddRunRequestInput =
      kind === 'permission'
        ? { runnerId: runner, kind, label, labelCut: false, questions: null }
        : { runnerId: runner, kind, label, labelCut: false, questions };
    return agent<RunRequest>('POST', `/api/runs/${runId}/requests`, input);
  };

  async function ticketRun(): Promise<string> {
    await person('POST', '/api/tickets/MOB-12/runs', { runnerId: runner, prompt: 'Go' });
    return (await agent<RunJob>('POST', `/api/runners/${runner}/next?kind=ticket`)).body.run.id;
  }

  beforeEach(async () => {
    service.reset();
    clock.set(Date.now());
    const owner = await addUser(api.db, 'owner@example.com', clock.now());
    const sam = await addUser(api.db, 'sam@example.com', clock.now() + 1);
    ownerId = owner.id;
    person = caller(() => api.app, owner.person);
    agent = caller(() => api.app, owner.helper);
    const samPerson = caller(() => api.app, sam.person);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    for (let num = 1; num <= 12; num += 1) {
      await person('POST', '/api/projects/MOB/tickets', { title: `Ticket ${num}` });
    }
    await agent('PUT', `/api/runners/${runner}`, helperName('Mac'));
    phone = await subscribe(person);
    samPhone = await subscribe(samPerson);
  });

  describe('a question on the ticket (ask_person)', () => {
    it('tells only the ticket’s user, without the question, opening the ticket', async () => {
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

  describe('a request in a ticket run', () => {
    it('names the command on the ticket, under the tag "Claude finished" replaces', async () => {
      const runId = await ticketRun();
      expect((await request(runId, 'Run git push\necho done')).status).toBe(201);
      const asks: PushMessage = {
        title: 'MOB-12: Claude wants to run git push',
        body: 'Ticket 12',
        url: '/p/MOB/12',
        tag: 'ticket:MOB-12',
      };
      expect(await service.messagesFor(phone)).toEqual([asks]);
      expect(service.forDevice(samPhone)).toEqual([]);
      await agent('POST', `/api/runs/${runId}/finish`, { status: 'done' });
      const [, finished] = await service.messagesFor(phone, 2);
      expect(finished).toMatchObject({ title: 'MOB-12: Claude finished', tag: asks.tag });
    });

    it('says Claude has a question for a question in the run, without the question', async () => {
      const runId = await ticketRun();
      await request(runId, QUESTION.question, 'question');
      expect(await service.messagesFor(phone)).toEqual([
        {
          title: 'MOB-12: Claude has a question',
          body: 'Ticket 12 · Open the ticket to answer.',
          url: '/p/MOB/12',
          tag: 'ticket:MOB-12',
        },
      ]);
    });
  });

  it('names the edit’s file in an Edit question and opens the chat', async () => {
    const started = await person<ChatDetail>('POST', '/api/projects/MOB/chats', {
      runnerId: runner,
      text: 'Rename the setting',
      mode: 'edit',
    });
    // An Edit question may change the folder, so it goes in the ticket lane.
    const job = await agent<RunJob>('POST', `/api/runners/${runner}/next?kind=ticket`);
    await request(job.body.run.id, 'Edit src/settings.ts\n- dark\n+ night');
    const { chat } = started.body;
    expect(await service.messagesFor(phone)).toEqual([
      {
        title: 'Claude wants to edit src/settings.ts',
        body: `Mobile · ${chat.title}`,
        url: `/p/MOB/ask/${chat.id}`,
        tag: `chat:${chat.id}`,
      },
    ]);
    expect(service.forDevice(samPhone)).toEqual([]);
  });

  it('sends nothing for a request answered before its push goes out', async () => {
    const runId = await ticketRun();
    const created = (await request(runId, 'Run npm test')).body;
    await service.messagesFor(phone);
    expect(
      (await person('POST', `/api/requests/${created.id}/answer`, { decision: 'allow' })).status,
    ).toBe(200);
    const send = vi.fn<ServiceContext['push']['send']>();
    const ctx = { db: api.db, now: clock.now, push: { send } } as unknown as ServiceContext;
    const run = await findRunInScope(api.db, ownerId, runId);
    const row = await findRunRequestRow(api.db, created.id);
    pushRunRequest(ctx, ownerId, run!, row!);
    await settle();
    expect(send).not.toHaveBeenCalled();
  });
});
