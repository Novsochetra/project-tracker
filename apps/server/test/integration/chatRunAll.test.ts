import { randomUUID } from 'node:crypto';
import type { ChatDetail, Run, RunAllResult, RunBatch, RunJob } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

const CARD = ['Sure, 3 at a time.', '', '````run-all', 'limit: 3', '````'].join('\n');

describe.each(DIALECTS)('Run all from a chat card (%s)', (dialect) => {
  const api = useTestServer(dialect);
  const runner = randomUUID();
  let person: Caller;
  let helper: Caller;
  let chatId: string;
  let answerId: string;
  let questionId: string;

  const confirm = (messageId = answerId, as: Caller = person) =>
    as<RunAllResult>('POST', `/api/chats/${chatId}/messages/${messageId}/run-all`, {
      runnerId: runner,
      maxParallel: 3,
      ticketKeys: ['MOB-1', 'MOB-2'],
    });
  const chat = async () => (await person<ChatDetail>('GET', `/api/chats/${chatId}`)).body;

  beforeEach(async () => {
    const owner = await addUser(api.db, 'owner@example.com', Date.now());
    person = caller(() => api.app, owner.person);
    helper = caller(() => api.app, owner.helper);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    for (const title of ['Crash', 'Login']) {
      await person('POST', '/api/projects/MOB/tickets', { title });
    }
    await helper('PUT', `/api/runners/${runner}`, helperName('Dara’s MacBook'));
    const started = await person<ChatDetail>('POST', '/api/projects/MOB/chats', {
      runnerId: runner,
      text: 'Do all Todo, 3 at a time',
    });
    chatId = started.body.chat.id;
    const job = (await helper<RunJob>('POST', `/api/runners/${runner}/next?kind=ask`)).body;
    await helper('POST', `/api/runs/${job.run.id}/finish`, { status: 'done', answer: CARD });
    const messages = (await chat()).messages;
    questionId = messages[0]?.id ?? '';
    answerId = messages[1]?.id ?? '';
  });

  it('starts nothing until the person confirms', async () => {
    expect((await chat()).messages[1]?.batchRunId).toBeNull();
    expect((await person<Run[]>('GET', '/api/tickets/MOB-1/runs')).body).toEqual([]);
  });

  it('starts one batch with the limit and keeps it on the card', async () => {
    const { status, body } = await confirm();
    expect(status).toBe(201);
    expect(body).toMatchObject({ queued: 2, maxParallel: 3 });
    expect((await chat()).messages[1]?.batchRunId).toBe(body.runId);
    const batch = (await person<RunBatch>('GET', `/api/runs/${body.runId}/batch`)).body;
    expect(batch.tickets.map(({ ticketKey }) => ticketKey)).toEqual(['MOB-1', 'MOB-2']);
    const job = (await helper<RunJob>('POST', `/api/runners/${runner}/next?kind=ticket&batches=1`))
      .body;
    expect(job.prompt).toContain('Run at most 3 sub agents at once.');
  });

  it('starts the card once, even when two taps race', async () => {
    const taps = await Promise.all([confirm(), confirm()]);
    expect(taps.map(({ status }) => status).sort()).toEqual([201, 409]);
    expect((await confirm()).status).toBe(409);
  });

  it("refuses the person's own message and a helper's token", async () => {
    expect((await confirm(questionId)).status).toBe(404);
    expect((await confirm(answerId, helper)).status).toBe(403);
    expect((await chat()).messages[1]?.batchRunId).toBeNull();
  });

  it('refuses an answer that has no Run all card', async () => {
    const asked = await person<ChatDetail>('POST', `/api/chats/${chatId}/messages`, {
      runnerId: runner,
      text: 'Thanks',
    });
    expect(asked.status).toBe(200);
    const job = (await helper<RunJob>('POST', `/api/runners/${runner}/next?kind=ask`)).body;
    await helper('POST', `/api/runs/${job.run.id}/finish`, { status: 'done', answer: 'Sure.' });
    const plain = (await chat()).messages[3]?.id ?? '';
    expect((await confirm(plain)).status).toBe(409);
  });

  it("keeps another user's chat out of reach", async () => {
    const other = await addUser(api.db, 'other@example.com', Date.now());
    expect(
      (
        await confirm(
          answerId,
          caller(() => api.app, other.person),
        )
      ).status,
    ).toBe(404);
  });
});
