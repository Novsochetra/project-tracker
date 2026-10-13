import { randomUUID } from 'node:crypto';
import type { ChatDetail, RunJob, TicketListItem } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { testClock } from '../helpers/auth';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

const card = (title: string) => ['````ticket', `title: ${title}`, '---', 'Why.', '````'];
const BROKEN = ['````ticket', 'priority: high', '````'];
const SPLIT = [
  'Three tickets:',
  ...card('First'),
  ...BROKEN,
  ...card('Second'),
  ...card('Third'),
].join('\n');

describe.each(DIALECTS)('several ticket cards in one answer (%s)', (dialect) => {
  const clock = testClock();
  const api = useTestServer(dialect, { now: clock.now });
  const runner = randomUUID();
  let person: Caller;
  let chatId: string;
  let messageId: string;

  const create = (index: number | undefined, title = `Card ${index ?? 0}`) =>
    person<ChatDetail>('POST', `/api/chats/${chatId}/messages/${messageId}/ticket`, {
      title,
      ...(index === undefined ? {} : { index }),
    });
  const links = async () =>
    (await person<ChatDetail>('GET', `/api/chats/${chatId}`)).body.messages[1]?.cardTickets;
  const titles = async () =>
    (await person<TicketListItem[]>('GET', '/api/projects/MOB/tickets')).body
      .map((ticket) => `${ticket.key} ${ticket.title}`)
      .sort();

  beforeEach(async () => {
    clock.set(1_000_000);
    const owner = await addUser(api.db, 'owner@example.com', clock.now());
    person = caller(() => api.app, owner.person);
    const helper = caller(() => api.app, owner.helper);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await helper('PUT', `/api/runners/${runner}`, helperName('Dara’s MacBook'));
    const started = await person<ChatDetail>('POST', '/api/projects/MOB/chats', {
      runnerId: runner,
      text: 'Split this into tickets',
    });
    chatId = started.body.chat.id;
    const job = (await helper<RunJob | null>('POST', `/api/runners/${runner}/next?kind=ask`)).body;
    clock.advance(1_000);
    await helper('POST', `/api/runs/${job?.run.id ?? ''}/finish`, {
      status: 'done',
      answer: SPLIT,
    });
    messageId =
      (await person<ChatDetail>('GET', `/api/chats/${chatId}`)).body.messages[1]?.id ?? '';
  });

  it('makes each card its own ticket in order, and a second round makes nothing new', async () => {
    for (const index of [0, 1, 2]) expect((await create(index)).status).toBe(200);
    const made = [
      { index: 0, ticketKey: 'MOB-1' },
      { index: 1, ticketKey: 'MOB-2' },
      { index: 2, ticketKey: 'MOB-3' },
    ];
    expect(await links()).toEqual(made);
    for (const index of [0, 1, 2]) await create(index, 'Changed');
    expect(await links()).toEqual(made);
    expect(await titles()).toEqual(['MOB-1 Card 0', 'MOB-2 Card 1', 'MOB-3 Card 2']);
  });

  it('makes one ticket when the same card is sent twice at once', async () => {
    await Promise.all([create(1), create(1)]);
    expect(await links()).toEqual([{ index: 1, ticketKey: 'MOB-1' }]);
    expect(await titles()).toEqual(['MOB-1 Card 1']);
  });

  it('finishes the rest after a round that failed part way, keeping what it made', async () => {
    await create(0);
    expect((await create(1, '  ')).status).toBe(400);
    for (const index of [0, 1, 2]) await create(index);
    expect((await links())?.map((link) => link.ticketKey)).toEqual(['MOB-1', 'MOB-2', 'MOB-3']);
  });

  it('takes no index as the first card, as an older page sends it', async () => {
    await create(undefined);
    expect(await links()).toEqual([{ index: 0, ticketKey: 'MOB-1' }]);
  });

  it('refuses a card the answer does not have', async () => {
    const missing = await create(3);
    expect(missing.status).toBe(404);
    expect(missing.body).toMatchObject({
      error: { code: 'not_found', message: 'That card was not found.' },
    });
    expect((await create(-1)).status).toBe(400);
    expect(await titles()).toEqual([]);
  });

  it('shows the card again once its ticket is deleted', async () => {
    await create(0);
    await create(1);
    expect((await person('DELETE', '/api/tickets/MOB-1')).status).toBe(204);
    expect(await links()).toEqual([{ index: 1, ticketKey: 'MOB-2' }]);
  });
});
