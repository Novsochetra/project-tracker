import { randomUUID } from 'node:crypto';
import {
  CHAT_NO_ANSWER,
  type Chat,
  type ChatDetail,
  type Run,
  type RunJob,
  type TicketDetail,
} from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { testClock } from '../helpers/auth';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

const SESSION = '11111111-2222-4333-8444-555555555555';
const CARD = [
  '````ticket',
  'title: Add a chat',
  'priority: high',
  '---',
  '## Why',
  'Phones.',
  '````',
];

describe.each(DIALECTS)('chats with Claude Code (%s)', (dialect) => {
  const clock = testClock();
  const api = useTestServer(dialect, { now: clock.now });
  const runner = randomUUID();
  const otherRunner = randomUUID();
  let person: Caller;
  let helper: Caller;

  const startChat = (text: string, runnerId = runner) =>
    person<ChatDetail>('POST', '/api/projects/MOB/chats', { runnerId, text });
  const ask = (chatId: string, text: string, runnerId = runner) =>
    person<ChatDetail>('POST', `/api/chats/${chatId}/messages`, { runnerId, text });
  const next = (id = runner) => helper<RunJob | null>('POST', `/api/runners/${id}/next?kind=ask`);
  const finish = (id: string, body: unknown) => helper<Run>('POST', `/api/runs/${id}/finish`, body);
  const chat = (id: string) => person<ChatDetail>('GET', `/api/chats/${id}`);

  async function answered(question: string, answer: string, runnerId = runner) {
    const started = await startChat(question, runnerId);
    const job = (await next(runnerId)).body;
    clock.advance(1_000);
    await finish(job?.run.id ?? '', { status: 'done', answer, sessionId: SESSION });
    return started.body.chat.id;
  }

  beforeEach(async () => {
    clock.set(1_000_000);
    const owner = await addUser(api.db, 'owner@example.com', clock.now());
    person = caller(() => api.app, owner.person);
    helper = caller(() => api.app, owner.helper);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await helper('PUT', `/api/runners/${runner}`, helperName('Dara’s MacBook'));
    await helper('PUT', `/api/runners/${otherRunner}`, helperName('Office Mac'));
  });

  it('starts a chat with the question and queues a read-only ask on the helper', async () => {
    const started = await startChat('  Where are runs queued?  ');
    expect(started.status).toBe(201);
    const { chat: made, messages, run } = started.body;
    expect(made).toEqual({
      id: expect.any(String),
      projectKey: 'MOB',
      title: 'Where are runs queued?',
      options: { model: 'default', mode: 'ask', effort: 'default' },
      waiting: false,
      createdAt: 1_000_000,
      updatedAt: 1_000_000,
    });
    expect(messages).toEqual([
      expect.objectContaining({ role: 'person', text: 'Where are runs queued?', ticketKey: null }),
    ]);
    expect(run).toMatchObject({
      kind: 'ask',
      role: 'work',
      ticketKey: null,
      chatId: made.id,
      askOptions: { model: 'default', mode: 'ask', effort: 'default' },
      status: 'queued',
    });

    const job = (await next()).body;
    expect(job?.run).toMatchObject({ id: run?.id, kind: 'ask', projectKey: 'MOB' });
    expect(job?.prompt).toContain('read-only');
    expect(job?.resumeSessionId).toBeNull();
    expect(job?.prompt).toContain('"Mobile" (MOB)');
    expect(job?.prompt.endsWith('Question:\nWhere are runs queued?')).toBe(true);
    const listed = await person<Chat[]>('GET', '/api/projects/MOB/chats');
    expect(listed.body.map((item) => item.id)).toEqual([made.id]);
  });

  it("adds Claude's answer and resumes its session for the next question on that helper", async () => {
    const chatId = await answered('Where are runs queued?', 'In runQueue.ts.');
    const detail = (await chat(chatId)).body;
    expect(detail.messages.map(({ role, text, runId }) => [role, text, runId])).toEqual([
      ['person', 'Where are runs queued?', null],
      ['claude', 'In runQueue.ts.', detail.run?.id],
    ]);
    expect(detail.run).toMatchObject({ status: 'done' });

    clock.advance(1_000);
    await ask(chatId, 'And who takes them?');
    const job = (await next()).body;
    expect(job?.resumeSessionId).toBe(SESSION);
    expect(job?.prompt).not.toContain('Earlier in this chat');
    const listed = await person<Chat[]>('GET', '/api/projects/MOB/chats');
    expect(listed.body[0]?.updatedAt).toBe(1_002_000);
  });

  it('gives another helper the chat so far instead of a session it lacks', async () => {
    const chatId = await answered('Where are runs queued?', 'In runQueue.ts.');
    await ask(chatId, 'And who takes them?', otherRunner);
    const job = (await next(otherRunner)).body;
    expect(job?.resumeSessionId).toBeNull();
    expect(job?.prompt).toContain('Person:\nWhere are runs queued?\n\nYou:\nIn runQueue.ts.');
  });

  it('counts the steps of the run that gave each answer, so older answers can fold theirs', async () => {
    const started = await startChat('Where are runs queued?');
    const job = (await next()).body;
    const step = { kind: 'tool', label: 'Read runQueue.ts', subAgent: false, toolId: null };
    const steps = { runnerId: runner, steps: [step, { ...step, label: 'Read runs.ts' }] };
    expect((await helper('POST', `/api/runs/${job?.run.id}/steps`, steps)).status).toBe(204);
    clock.advance(1_000);
    await finish(job?.run.id ?? '', {
      status: 'done',
      answer: 'In runQueue.ts.',
      sessionId: SESSION,
    });
    const chatId = started.body.chat.id;
    clock.advance(1_000);
    await ask(chatId, 'And who takes them?');
    clock.advance(1_000);
    await finish((await next()).body?.run.id ?? '', { status: 'done', answer: 'The helper.' });

    const { messages } = (await chat(chatId)).body;
    expect(messages.map(({ role, stepCount }) => [role, stepCount])).toEqual([
      ['person', 0],
      ['claude', 2],
      ['person', 0],
      ['claude', 0],
    ]);
  });

  it('keeps the questions that stopped after Claude took steps, oldest first', async () => {
    const step = { kind: 'tool', label: 'Read runQueue.ts', subAgent: false, toolId: null };
    const chatId = (await startChat('First?')).body.chat.id;
    const first = (await next()).body?.run.id ?? '';
    await helper('POST', `/api/runs/${first}/steps`, { runnerId: runner, steps: [step, step] });
    await person('POST', `/api/runs/${first}/cancel`);
    await finish(first, { status: 'cancelled' });
    clock.advance(1_000);
    await ask(chatId, 'Second?');
    await finish((await next()).body?.run.id ?? '', { status: 'failed', error: 'Lost.' });
    clock.advance(1_000);
    await ask(chatId, 'Third?');
    const third = (await next()).body?.run.id ?? '';
    await helper('POST', `/api/runs/${third}/steps`, { runnerId: runner, steps: [step] });
    await finish(third, { status: 'failed', error: 'Claude Code exited with 1.' });
    clock.advance(1_000);
    await ask(chatId, 'Fourth?');
    const fourth = (await next()).body?.run.id ?? '';
    await helper('POST', `/api/runs/${fourth}/steps`, { runnerId: runner, steps: [step] });
    clock.advance(1_000);
    await finish(fourth, { status: 'done', answer: 'Yes.', sessionId: SESSION });

    const detail = (await chat(chatId)).body;
    expect(detail.stoppedRuns.map(({ id, status, stepCount }) => [id, status, stepCount])).toEqual([
      [first, 'cancelled', 2],
      [third, 'failed', 1],
    ]);
    expect(detail.messages.map(({ role }) => role)).toEqual([
      'person',
      'person',
      'person',
      'person',
      'claude',
    ]);
    expect(detail.run?.id).toBe(fourth);
  });

  it('allows one question at a time in a chat, without blocking a ticket run', async () => {
    const chatId = (await startChat('First?')).body.chat.id;
    const busy = await ask(chatId, 'Second?');
    expect(busy.status).toBe(409);
    expect((await chat(chatId)).body.messages).toHaveLength(1);
    await person('POST', '/api/projects/MOB/tickets', { title: 'Crash' });
    const ticketRun = await person('POST', '/api/tickets/MOB-1/runs', {
      runnerId: runner,
      prompt: 'Go',
    });
    expect(ticketRun.status).toBe(201);
  });

  it('fails an ask that ends without an answer and lets the person ask again', async () => {
    const chatId = (await startChat('Anything?')).body.chat.id;
    const job = (await next()).body;
    const ended = await finish(job?.run.id ?? '', { status: 'done' });
    expect(ended.body).toMatchObject({ status: 'failed', error: CHAT_NO_ANSWER });
    expect((await chat(chatId)).body.messages).toHaveLength(1);
    expect((await ask(chatId, 'Again?')).status).toBe(200);
  });

  it("makes the card's ticket as the person, once, however often Create is tapped", async () => {
    const chatId = await answered('Make it a ticket', ['Here it is.', ...CARD].join('\n'));
    const answer = (await chat(chatId)).body.messages[1];
    const create = () =>
      person<ChatDetail>('POST', `/api/chats/${chatId}/messages/${answer?.id}/ticket`, {
        title: 'Add a chat (edited)',
        description: '## Why\nPhones.',
        priority: 'high',
      });
    const first = await create();
    expect(first.status).toBe(200);
    expect(first.body.messages[1]?.ticketKey).toBe('MOB-1');
    expect((await create()).body.messages[1]?.ticketKey).toBe('MOB-1');
    const ticket = await person<TicketDetail>('GET', '/api/tickets/MOB-1');
    expect(ticket.body.ticket).toMatchObject({ title: 'Add a chat (edited)', priority: 'high' });
    expect(ticket.body.activity[0]?.actor.kind).toBe('human');
    const tickets = await person<unknown[]>('GET', '/api/projects/MOB/tickets');
    expect(tickets.body).toHaveLength(1);
  });

  it('refuses a ticket from the person’s own question', async () => {
    const started = await startChat('Question');
    const question = started.body.messages[0];
    const made = await person(
      'POST',
      `/api/chats/${started.body.chat.id}/messages/${question?.id}/ticket`,
      { title: 'T' },
    );
    expect(made.status).toBe(404);
  });

  it('lets only a person ask or create, so agents cannot start more agents', async () => {
    const chatId = await answered('Q', 'A');
    const answer = (await chat(chatId)).body.messages[1];
    const refused = [
      await helper('POST', '/api/projects/MOB/chats', { runnerId: runner, text: 'Q' }),
      await helper('POST', `/api/chats/${chatId}/messages`, { runnerId: runner, text: 'Q' }),
      await helper('POST', `/api/chats/${chatId}/messages/${answer?.id}/ticket`, { title: 'T' }),
    ];
    expect(refused.map((answered) => answered.status)).toEqual([403, 403, 403]);
  });

  it("hides another user's chats", async () => {
    const chatId = await answered('Mine?', 'Yes.');
    const other = await addUser(api.db, 'other@example.com', clock.now());
    const stranger = caller(() => api.app, other.person);
    expect((await stranger('GET', `/api/chats/${chatId}`)).status).toBe(404);
    expect((await stranger('GET', '/api/projects/MOB/chats')).status).toBe(404);
    expect(
      (await stranger('POST', `/api/chats/${chatId}/messages`, { runnerId: runner, text: 'Q' }))
        .status,
    ).toBe(404);
  });

  it('refuses a helper that does not serve the project', async () => {
    const elsewhere = randomUUID();
    await person('POST', '/api/projects', { name: 'Web', key: 'WEB' });
    await helper('PUT', `/api/runners/${elsewhere}`, { name: 'Web Mac', projectKeys: ['WEB'] });
    const refused = await startChat('Q', elsewhere);
    expect(refused.status).toBe(409);
    expect((await person<Chat[]>('GET', '/api/projects/MOB/chats')).body).toEqual([]);
  });
});
