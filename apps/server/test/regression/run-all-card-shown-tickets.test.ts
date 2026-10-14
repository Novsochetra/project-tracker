import { randomUUID } from 'node:crypto';
import type { ChatDetail, ErrorBody, Run, RunAllResult, RunJob } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

const CARD = ['On it.', '', '```run-all', '```'].join('\n');

// PT-245: Confirm picked the To do tickets again, so a ticket made after the card loaded ran
// unseen, and a card the chat showed as replaced still started a batch.
describe.each(DIALECTS)('regression: a Run all card runs what it showed (%s)', (dialect) => {
  const api = useTestServer(dialect);
  const runner = randomUUID();
  let person: Caller;
  let helper: Caller;
  let chatId: string;

  const answer = async (text: string) => {
    const job = (await helper<RunJob>('POST', `/api/runners/${runner}/next?kind=ask`)).body;
    await helper('POST', `/api/runs/${job.run.id}/finish`, { status: 'done', answer: text });
  };
  const cardIds = async () =>
    (await person<ChatDetail>('GET', `/api/chats/${chatId}`)).body.messages
      .filter(({ role }) => role === 'claude')
      .map(({ id }) => id);
  const confirm = (messageId: string, ticketKeys: string[]) =>
    person<RunAllResult & ErrorBody>('POST', `/api/chats/${chatId}/messages/${messageId}/run-all`, {
      runnerId: runner,
      ticketKeys,
    });

  beforeEach(async () => {
    const owner = await addUser(api.db, 'owner@example.com', Date.now());
    person = caller(() => api.app, owner.person);
    helper = caller(() => api.app, owner.helper);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    for (const title of ['Crash', 'Login']) {
      await person('POST', '/api/projects/MOB/tickets', { title });
    }
    await helper('PUT', `/api/runners/${runner}`, helperName('Mac'));
    const started = await person<ChatDetail>('POST', '/api/projects/MOB/chats', {
      runnerId: runner,
      text: 'Run all To do',
    });
    chatId = started.body.chat.id;
    await answer(CARD);
  });

  it('answers 409 when a ticket was added after the card loaded, and runs none', async () => {
    const [card = ''] = await cardIds();
    await person('POST', '/api/projects/MOB/tickets', { title: 'Made in between' });
    const stale = await confirm(card, ['MOB-1', 'MOB-2']);
    expect(stale.status).toBe(409);
    expect(stale.body.error.message).toBe('The To do list changed. Check the card again.');
    expect((await person<Run[]>('GET', '/api/tickets/MOB-3/runs')).body).toEqual([]);
    expect((await person<Run[]>('GET', '/api/tickets/MOB-1/runs')).body).toEqual([]);

    const fresh = await confirm(card, ['MOB-1', 'MOB-2', 'MOB-3']);
    expect(fresh.status).toBe(201);
    expect(fresh.body.queued).toBe(3);
  });

  it('refuses a card that a newer card replaced', async () => {
    await person('POST', `/api/chats/${chatId}/messages`, { runnerId: runner, text: 'Again' });
    await answer(CARD);
    const [older = '', newer = ''] = await cardIds();
    const replaced = await confirm(older, ['MOB-1', 'MOB-2']);
    expect(replaced.status).toBe(409);
    expect(replaced.body.error.message).toBe('A newer Run all card replaced this one.');
    expect((await person<Run[]>('GET', '/api/tickets/MOB-1/runs')).body).toEqual([]);
    expect((await confirm(newer, ['MOB-1', 'MOB-2'])).status).toBe(201);
  });
});
