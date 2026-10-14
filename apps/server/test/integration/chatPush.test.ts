import { randomUUID } from 'node:crypto';
import type { ChatDetail, FinishRunInput, RunJob } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { startSession } from '../../src/auth/sessions';
import { SESSION_COOKIE } from '../../src/http/sessionCookie';
import { VIEWING_MS } from '../../src/push/chatViewers';
import { testClock } from '../helpers/auth';
import { fakePushService, newDevice, type Device } from '../helpers/push';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

const SECRETS = ['hunter2', 'sk-ant-api03-abcdefghij', 'mysql -u root', 'DATABASE_URL'];
const ANSWER = [
  'Your .env has DATABASE_URL=postgres://root:hunter2@db and',
  '```sh',
  'mysql -u root -phunter2 && export KEY=sk-ant-api03-abcdefghij',
  '```',
].join('\n');

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

describe.each(DIALECTS)('push when a chat answer ends (%s)', (dialect) => {
  const clock = testClock();
  const service = fakePushService();
  const api = useTestServer(dialect, { now: clock.now, push: { send: service.send } });
  const runner = randomUUID();
  let person: Caller;
  let laptop: Caller;
  let helper: Caller;
  let phone: Device;
  let laptopDevice: Device;

  const subscribe = async (as: Caller) => {
    const device = newDevice();
    expect((await as('PUT', '/api/push/subscription', device.subscription)).status).toBe(204);
    return device;
  };

  async function chatEnds(finish: FinishRunInput) {
    const started = await person<ChatDetail>('POST', '/api/projects/MOB/chats', {
      runnerId: runner,
      text: 'Where is the database password?',
    });
    const job = await helper<RunJob>('POST', `/api/runners/${runner}/next?kind=ask`);
    await helper('POST', `/api/runs/${job.body.run.id}/finish`, finish);
    return started.body.chat;
  }

  const startChat = async () =>
    (
      await person<ChatDetail>('POST', '/api/projects/MOB/chats', {
        runnerId: runner,
        text: 'Where is the database password?',
      })
    ).body.chat;

  async function answerChat(chatId: string) {
    await person('POST', `/api/chats/${chatId}/messages`, { runnerId: runner, text: 'And?' });
    const job = await helper<RunJob>('POST', `/api/runners/${runner}/next?kind=ask`);
    await helper('POST', `/api/runs/${job.body.run.id}/finish`, { status: 'done', answer: 'Yes' });
  }

  const view = (as: Caller, chatId: string | null) => as('PUT', '/api/push/viewing', { chatId });

  beforeEach(async () => {
    service.reset();
    clock.set(Date.now());
    const owner = await addUser(api.db, 'owner@example.com', clock.now());
    person = caller(() => api.app, owner.person);
    helper = caller(() => api.app, owner.helper);
    const second = await startSession(api.db, owner.id, clock.now());
    laptop = caller(() => api.app, { cookie: `${SESSION_COOKIE}=${second.secret}` });
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await helper('PUT', `/api/runners/${runner}`, helperName('Mac'));
    phone = await subscribe(person);
    laptopDevice = await subscribe(laptop);
  });

  it('says the answer is ready, with the chat and project, and none of its text', async () => {
    const chat = await chatEnds({ status: 'done', answer: ANSWER });
    const [message] = await service.messagesFor(phone);
    expect(message).toEqual({
      title: `Claude answered: ${chat.title}`,
      body: 'Mobile · Open the chat to read it.',
      url: `/p/MOB/ask/${chat.id}`,
      tag: `chat:${chat.id}`,
    });
    for (const secret of SECRETS) expect(JSON.stringify(message)).not.toContain(secret);
  });

  it('says a failed answer stopped, without the error the helper sent', async () => {
    const error = 'Command failed: mysql -u root -phunter2\nDATABASE_URL is not set';
    const chat = await chatEnds({ status: 'failed', error });
    const [message] = await service.messagesFor(phone);
    expect(message).toEqual({
      title: `Claude stopped: ${chat.title}`,
      body: 'Mobile · Open the chat to see why.',
      url: `/p/MOB/ask/${chat.id}`,
      tag: `chat:${chat.id}`,
    });
    for (const secret of SECRETS) expect(JSON.stringify(message)).not.toContain(secret);
  });

  it('counts an answer with no text as failed, and says nothing for a cancel', async () => {
    const chat = await chatEnds({ status: 'done', answer: ' ' });
    expect((await service.messagesFor(phone))[0]?.title).toBe(`Claude stopped: ${chat.title}`);
    await chatEnds({ status: 'cancelled' });
    await settle();
    expect(service.forDevice(phone)).toHaveLength(1);
  });

  it('skips the device that shows the chat, until it leaves or stops saying so', async () => {
    const chat = await startChat();
    expect((await view(person, chat.id)).status).toBe(204);
    const job = await helper<RunJob>('POST', `/api/runners/${runner}/next?kind=ask`);
    await helper('POST', `/api/runs/${job.body.run.id}/finish`, { status: 'done', answer: 'Yes' });
    await service.messagesFor(laptopDevice);
    expect(service.forDevice(phone)).toEqual([]);

    await view(person, null);
    await answerChat(chat.id);
    await service.messagesFor(phone);

    await view(person, chat.id);
    clock.advance(VIEWING_MS + 1);
    await answerChat(chat.id);
    await service.messagesFor(phone, 2);
  });

  it('still tells a device that shows another chat', async () => {
    await view(person, 'another-chat');
    await chatEnds({ status: 'done', answer: 'Yes' });
    await service.messagesFor(phone);
  });

  it('takes what a device shows only from a person', async () => {
    expect((await view(helper, 'c-1')).status).toBe(403);
    expect((await view(person, 'x'.repeat(101))).status).toBe(400);
  });
});
