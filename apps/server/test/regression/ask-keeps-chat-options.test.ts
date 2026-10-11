import { randomUUID } from 'node:crypto';
import type { ChatDetail, RunJob } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { testClock } from '../helpers/auth';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

// PT-160 review: zod defaulted a missing model and mode to Default and Ask, so a question that
// left them out reset the chat's saved choice.
describe.each(DIALECTS)('regression: a question that names no options (%s)', (dialect) => {
  const clock = testClock();
  const api = useTestServer(dialect, { now: clock.now });
  const runner = randomUUID();
  let person: Caller;
  let helper: Caller;

  const answer = async (lane: 'ask' | 'ticket') => {
    const job = await helper<RunJob>('POST', `/api/runners/${runner}/next?kind=${lane}`);
    await helper('POST', `/api/runs/${job.body.run.id}/finish`, { status: 'done', answer: 'A' });
    clock.advance(1_000);
  };
  const ask = (chatId: string, options: object) =>
    person<ChatDetail>('POST', `/api/chats/${chatId}/messages`, {
      runnerId: runner,
      text: 'Q',
      ...options,
    });

  beforeEach(async () => {
    clock.set(1_000_000);
    const owner = await addUser(api.db, 'owner@example.com', clock.now());
    person = caller(() => api.app, owner.person);
    helper = caller(() => api.app, owner.helper);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await helper('PUT', `/api/runners/${runner}`, helperName('Mac'));
  });

  it('keeps the chat’s saved model, mode and effort, and a new chat starts with the defaults', async () => {
    const started = await person<ChatDetail>('POST', '/api/projects/MOB/chats', {
      runnerId: runner,
      text: 'Q',
    });
    expect(started.body.chat.options).toEqual({ model: 'default', mode: 'ask', effort: 'default' });
    await answer('ask');
    const chatId = started.body.chat.id;
    await ask(chatId, { model: 'opus', mode: 'plan', effort: 'max' });
    await answer('ask');

    const kept = await ask(chatId, {});
    const saved = { model: 'opus', mode: 'plan', effort: 'max' };
    expect(kept.body.chat.options).toEqual(saved);
    expect(kept.body.run?.askOptions).toEqual(saved);
    await answer('ask');
    const modeOnly = await ask(chatId, { mode: 'edit' });
    expect(modeOnly.body.run?.askOptions).toEqual({ ...saved, mode: 'edit' });
    await answer('ticket');
    const modelOnly = await ask(chatId, { model: 'haiku' });
    expect(modelOnly.body.chat.options).toEqual({ ...saved, model: 'haiku', mode: 'edit' });
  });
});
