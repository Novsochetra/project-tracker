import { describe, expect, it } from 'vitest';
import { makeAskRun, makeChat, makeChatDetail, makeMessage } from '../../api/test/chatFixtures';
import { makeRunner } from '../../api/test/runFixtures';
import { doItOptions, helperAway, planHelper, planToDo } from './planToDo';

const plan = makeAskRun({
  status: 'done',
  endedAt: Date.now(),
  askOptions: { model: 'opus', mode: 'plan', effort: 'high' },
});
const answered = (run = plan) =>
  makeChatDetail({
    messages: [
      makeMessage({ text: 'Plan the sync fix' }),
      makeMessage({ id: 'm-2', role: 'claude', text: '1. Batch.', runId: run.id }),
    ],
    run,
  });

describe('planToDo', () => {
  it('offers the latest answer to a Plan question', () => {
    expect(planToDo(answered())).toBe(plan);
  });

  it('offers nothing for an Ask or Edit answer', () => {
    for (const mode of ['ask', 'edit'] as const) {
      const run = { ...plan, askOptions: { ...plan.askOptions!, mode } };
      expect(planToDo(answered(run))).toBeNull();
    }
  });

  it('offers nothing while the next question waits or runs, or after it failed', () => {
    for (const status of ['queued', 'running', 'failed', 'cancelled'] as const) {
      const next = makeAskRun({ id: 'r-next', status, askOptions: plan.askOptions });
      const detail = answered();
      const asked = [...detail.messages, makeMessage({ id: 'm-3', text: 'Smaller steps' })];
      expect(planToDo({ messages: asked, run: next })).toBeNull();
    }
  });

  it('offers nothing for an older plan or a chat not loaded yet', () => {
    const later = makeAskRun({ id: 'r-later', status: 'done', endedAt: Date.now() });
    const messages = [
      ...answered().messages,
      makeMessage({ id: 'm-3', text: 'Is it safe?' }),
      makeMessage({ id: 'm-4', role: 'claude', text: 'Yes.', runId: later.id }),
    ];
    expect(planToDo({ messages, run: later })).toBeNull();
    expect(planToDo({ messages, run: plan })).toBeNull();
    expect(planToDo(null)).toBeNull();
    expect(planToDo({ messages: [], run: plan })).toBeNull();
  });
});

describe('planHelper', () => {
  it('is the helper that made the plan while it is online and serves the project', () => {
    const dara = makeRunner();
    const other = makeRunner({ id: 'h-sam', name: "Sam's PC" });
    expect(planHelper(plan, [other, dara], 'mob')).toBe(dara);
    expect(planHelper(plan, [other, { ...dara, online: false }], 'MOB')).toBeNull();
    expect(planHelper(plan, [{ ...dara, projectKeys: ['WEB'] }], 'MOB')).toBeNull();
    expect(planHelper({ runnerId: null }, [dara], 'MOB')).toBeNull();
  });
});

describe('helperAway', () => {
  it('tells an offline helper from one online elsewhere and one removed', () => {
    const dara = makeRunner();
    expect(helperAway(plan, [{ ...dara, online: false }])).toBe('offline');
    expect(helperAway(plan, [{ ...dara, projectKeys: ['WEB'] }])).toBe('elsewhere');
    expect(helperAway(plan, [makeRunner({ id: 'h-sam' })])).toBe('removed');
    expect(helperAway({ runnerId: null }, [dara])).toBe('removed');
  });
});

describe('doItOptions', () => {
  it('keeps the chat’s model and effort and asks in Edit', () => {
    const chat = makeChat({ options: { model: 'opus', mode: 'plan', effort: 'high' } });
    expect(doItOptions(chat)).toEqual({ model: 'opus', mode: 'edit', effort: 'high' });
  });
});
