import { randomUUID } from 'node:crypto';
import type {
  AddRunRequestInput,
  ChatDetail,
  Run,
  RunJob,
  RunRequest,
  RunStepInput,
} from '@tracker/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBroadcaster } from '../../src/events/broadcaster';
import type { RunNotice } from '../../src/events/runNotice';
import { testClock } from '../helpers/auth';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

const STEP: RunStepInput = { kind: 'tool', label: 'Read a.ts', subAgent: false, toolId: 'toolu_1' };

describe.each(DIALECTS)("deleting a chat with its runs' steps and requests (%s)", (dialect) => {
  const clock = testClock();
  const runEvents = createBroadcaster<RunNotice>();
  const api = useTestServer(dialect, { now: clock.now, runEvents });
  const runner = randomUUID();
  let person: Caller;
  let helper: Caller;

  const take = async (lane: 'ask' | 'ticket') =>
    (await helper<RunJob>('POST', `/api/runners/${runner}/next?kind=${lane}`)).body.run;
  const sendStep = (run: Run) =>
    helper('POST', `/api/runs/${run.id}/steps`, { runnerId: runner, steps: [STEP] });
  const permission: AddRunRequestInput = {
    runnerId: runner,
    kind: 'permission',
    label: 'Run npm test',
    labelCut: false,
    questions: null,
  };
  const openRequest = async (run: Run) =>
    (await helper<RunRequest>('POST', `/api/runs/${run.id}/requests`, permission)).body;
  const wait = (id: string) =>
    helper<RunRequest>('GET', `/api/requests/${id}/wait?runnerId=${runner}`);
  const ask = (path: string) =>
    person<ChatDetail>('POST', path, { runnerId: runner, text: 'Rename it', mode: 'edit' });
  const remove = (chatId: string) => person('DELETE', `/api/chats/${chatId}`);
  const rowsOf = (table: 'runSteps' | 'runRequests', runIds: string[]) =>
    api.db.selectFrom(table).select('runId').where('runId', 'in', runIds).execute();

  beforeEach(async () => {
    clock.set(Date.now());
    const owner = await addUser(api.db, 'owner@example.com', clock.now());
    person = caller(() => api.app, owner.person);
    helper = caller(() => api.app, owner.helper);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await person('POST', '/api/projects/MOB/tickets', { title: 'Crash' });
    await helper('PUT', `/api/runners/${runner}`, helperName('Mac'));
  });

  async function startEdit() {
    const chatId = (await ask('/api/projects/MOB/chats')).body.chat.id;
    return { chatId, run: await take('ticket') };
  }

  it('takes the steps and requests of every run of the chat, and no other run’s', async () => {
    const { chatId, run: first } = await startEdit();
    await sendStep(first);
    await helper('POST', `/api/runs/${first.id}/finish`, { status: 'done', answer: 'Done.' });
    clock.advance(1_000);
    await ask(`/api/chats/${chatId}/messages`);
    const second = await take('ticket');
    await sendStep(second);
    await openRequest(second);
    const ticketRun = (
      await person<Run>('POST', '/api/tickets/MOB-1/runs', { runnerId: runner, prompt: 'Go' })
    ).body;

    expect((await remove(chatId)).status).toBe(204);
    const chatRuns = [first.id, second.id];
    expect(await rowsOf('runSteps', chatRuns)).toEqual([]);
    expect(await rowsOf('runRequests', chatRuns)).toEqual([]);
    expect(await api.db.selectFrom('runs').select('id').execute()).toEqual([{ id: ticketRun.id }]);
  });

  it('ends a request Claude waits on, so the helper stops waiting', async () => {
    const { chatId, run } = await startEdit();
    const request = await openRequest(run);
    const waiting = wait(request.id);
    await vi.waitFor(() => expect(runEvents.listenerCount()).toBe(1));

    expect((await remove(chatId)).status).toBe(204);
    // The wait wakes on the cancelled run; it reads the request just before or just after the
    // chat goes, and either way the helper stops asking (refusalOf reads a 404 as RUN_GONE).
    const ended = await waiting;
    if (ended.status === 200) expect(ended.body.status).toBe('cancelled');
    else expect(ended.status).toBe(404);
    expect(runEvents.listenerCount()).toBe(0);
    expect((await wait(request.id)).status).toBe(404);
    expect(
      (await person('POST', `/api/requests/${request.id}/answer`, { decision: 'allow' })).status,
    ).toBe(404);
  });
});
