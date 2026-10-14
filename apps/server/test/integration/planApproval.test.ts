import { randomUUID } from 'node:crypto';
import {
  PLAN_FOLLOW_UP,
  type AskMode,
  type ChatDetail,
  type RunJob,
  type RunRequest,
} from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { testClock } from '../helpers/auth';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

const SESSION = '5f0c3c1e-8a7b-4c2d-9e1f-2a3b4c5d6e7f';

describe.each(DIALECTS)('approving a plan in a chat (%s)', (dialect) => {
  const clock = testClock();
  const api = useTestServer(dialect, { now: clock.now });
  const runner = randomUUID();
  let person: Caller;
  let helper: Caller;

  const next = (lane: 'ticket' | 'ask') =>
    helper<RunJob | null>('POST', `/api/runners/${runner}/next?kind=${lane}`);
  const chatIn = async (mode: AskMode) => {
    const body = { runnerId: runner, text: 'Plan the queue', mode };
    const started = await person<ChatDetail>('POST', '/api/projects/MOB/chats', body);
    const job = (await next(mode === 'plan' ? 'ask' : 'ticket')).body;
    return { chatId: started.body.chat.id, runId: job?.run.id ?? '' };
  };
  const plan = async (runId: string, as = helper) =>
    (
      await as<RunRequest>('POST', `/api/runs/${runId}/requests`, {
        runnerId: runner,
        kind: 'plan',
        label: '# Plan\n\n1. Add the queue',
        labelCut: false,
        questions: null,
      })
    ).body;
  const answer = (id: string, body: unknown, as = person) =>
    as<RunRequest>('POST', `/api/requests/${id}/answer`, body);
  const finish = (runId: string) =>
    helper('POST', `/api/runs/${runId}/finish`, {
      status: 'done',
      answer: 'The plan is approved.',
      sessionId: SESSION,
    });
  const chat = async (chatId: string) =>
    (await person<ChatDetail>('GET', `/api/chats/${chatId}`)).body;

  beforeEach(async () => {
    clock.set(1_000_000);
    const owner = await addUser(api.db, 'owner@example.com', clock.now());
    person = caller(() => api.app, owner.person);
    helper = caller(() => api.app, owner.helper);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await helper('PUT', `/api/runners/${runner}`, helperName('Mac'));
  });

  it.each(['edit', 'auto'] as const)(
    'carries the plan out in %s, the mode the person picked',
    async (mode) => {
      const { chatId, runId } = await chatIn('plan');
      const request = await plan(runId);
      expect((await chat(chatId)).chat.waiting).toBe(true);
      expect((await answer(request.id, { decision: 'allow', answers: [mode] })).body).toMatchObject(
        { status: 'answered', decision: 'allow', answers: [mode] },
      );
      clock.advance(1_000);
      await finish(runId);

      const after = await chat(chatId);
      expect(after.messages.map((message) => message.text)).toEqual([
        'Plan the queue',
        'The plan is approved.',
        PLAN_FOLLOW_UP,
      ]);
      expect(after.run).toMatchObject({ status: 'queued', askOptions: { mode } });
      expect(after.chat.options.mode).toBe(mode);
      const job = (await next('ticket')).body;
      expect(job).toMatchObject({ resumeSessionId: SESSION, run: { askOptions: { mode } } });
      expect(job?.prompt).toContain(PLAN_FOLLOW_UP);
    },
  );

  it('keeps planning with the note and starts nothing', async () => {
    const { chatId, runId } = await chatIn('plan');
    const request = await plan(runId);
    const kept = await answer(request.id, { decision: 'deny', answers: ['Add tests first'] });
    expect(kept.body).toMatchObject({ decision: 'deny', answers: ['Add tests first'] });
    await finish(runId);
    const after = await chat(chatId);
    expect(after.messages).toHaveLength(2);
    expect(after.run?.status).toBe('done');
  });

  it('starts nothing when Claude planned again after the approval', async () => {
    const { chatId, runId } = await chatIn('plan');
    await answer((await plan(runId)).id, { decision: 'allow', answers: ['edit'] });
    clock.advance(1);
    await plan(runId);
    await finish(runId);
    expect((await chat(chatId)).messages).toHaveLength(2);
  });

  it('refuses an approval without a mode, and one from the helper', async () => {
    const { runId } = await chatIn('plan');
    const request = await plan(runId);
    expect((await answer(request.id, { decision: 'allow' })).status).toBe(400);
    expect((await answer(request.id, { decision: 'allow', answers: ['plan'] })).status).toBe(400);
    expect(
      (await answer(request.id, { decision: 'allow', answers: ['auto'] }, helper)).status,
    ).toBe(403);
  });

  it('starts nothing for a run that is not a Plan question', async () => {
    const { chatId, runId } = await chatIn('edit');
    await answer((await plan(runId)).id, { decision: 'allow', answers: ['auto'] });
    await finish(runId);
    expect((await chat(chatId)).messages).toHaveLength(2);
  });
});
