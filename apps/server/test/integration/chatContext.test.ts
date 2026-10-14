import { randomUUID } from 'node:crypto';
import type { ChatDetail, RunJob, RunUsageInput } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { testClock } from '../helpers/auth';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

describe.each(DIALECTS)("a chat's context (%s)", (dialect) => {
  const clock = testClock();
  const api = useTestServer(dialect, { now: clock.now });
  const runner = randomUUID();
  let person: Caller;
  let helper: Caller;

  const chatOf = async (chatId: string) =>
    (await person<ChatDetail>('GET', `/api/chats/${chatId}`)).body;

  async function answer(usage: RunUsageInput | undefined, status = 'done') {
    const job = (await helper<RunJob>('POST', `/api/runners/${runner}/next?kind=ask`)).body;
    clock.advance(1_000);
    const ending = status === 'done' ? { answer: 'Yes.' } : { error: 'Stopped.' };
    await helper('POST', `/api/runs/${job.run.id}/finish`, { status, ...ending, usage });
  }

  async function chatWith(usage?: RunUsageInput): Promise<string> {
    const started = await person<ChatDetail>('POST', '/api/projects/MOB/chats', {
      runnerId: runner,
      text: 'Where are runs queued?',
    });
    await answer(usage);
    return started.body.chat.id;
  }

  const ask = (chatId: string) =>
    person('POST', `/api/chats/${chatId}/messages`, { runnerId: runner, text: 'And then?' });

  beforeEach(async () => {
    clock.set(1_000_000);
    const owner = await addUser(api.db, 'owner@example.com', clock.now());
    person = caller(() => api.app, owner.person);
    helper = caller(() => api.app, owner.helper);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await helper('PUT', `/api/runners/${runner}`, helperName('Dara’s MacBook'));
  });

  it("shows the latest answer's context and every answer's tokens", async () => {
    const chatId = await chatWith({
      contextTokens: 40_000,
      contextWindow: 200_000,
      tokens: 90_000,
    });
    expect((await chatOf(chatId)).context).toEqual({
      used: 40_000,
      window: 200_000,
      tokens: 90_000,
    });
    await ask(chatId);
    await answer({ contextTokens: 170_000, contextWindow: 200_000, tokens: 400_000 });
    expect((await chatOf(chatId)).context).toEqual({
      used: 170_000,
      window: 200_000,
      tokens: 490_000,
    });
  });

  it('keeps the last context while a stopped run that sent none adds its tokens', async () => {
    const chatId = await chatWith({ contextTokens: 40_000, contextWindow: 200_000, tokens: 1_000 });
    await ask(chatId);
    await answer({ tokens: 500 }, 'failed');
    expect((await chatOf(chatId)).context).toEqual({
      used: 40_000,
      window: 200_000,
      tokens: 1_500,
    });
  });

  it('says nothing for a chat whose helper sent no context', async () => {
    expect((await chatOf(await chatWith())).context).toBeUndefined();
    expect((await chatOf(await chatWith({ turns: 2 }))).context).toBeUndefined();
  });

  it('refuses a window of 0 and context that is not a whole number', async () => {
    await person('POST', '/api/projects/MOB/chats', { runnerId: runner, text: 'Hi' });
    const job = (await helper<RunJob>('POST', `/api/runners/${runner}/next?kind=ask`)).body;
    const finish = (usage: unknown) =>
      helper('POST', `/api/runs/${job.run.id}/finish`, { status: 'done', answer: 'Hi', usage });
    expect((await finish({ contextWindow: 0 })).status).toBe(400);
    expect((await finish({ contextTokens: 1.5 })).status).toBe(400);
    expect((await finish({ tokens: -1 })).status).toBe(400);
  });
});
