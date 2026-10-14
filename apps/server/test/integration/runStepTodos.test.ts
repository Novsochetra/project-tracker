import { randomUUID } from 'node:crypto';
import type { ChatDetail, RunJob, RunStep, RunStepInput, RunTodo } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

const todoStep = (todos: RunTodo[], toolId: string): RunStepInput => ({
  kind: 'tool',
  label: 'Update the to-do list',
  subAgent: false,
  toolId,
  todos,
});
const readStep: RunStepInput = { kind: 'tool', label: 'Read a.ts', subAgent: false, toolId: null };

const first: RunTodo[] = [
  { text: 'Read the code', status: 'in_progress' },
  { text: 'Fix it', status: 'pending' },
];
const last: RunTodo[] = [
  { text: 'Read the code', status: 'completed' },
  { text: 'Fix it', status: 'completed' },
];

describe.each(DIALECTS)("Claude's to-do list (%s)", (dialect) => {
  const api = useTestServer(dialect);
  const runner = randomUUID();
  let person: Caller;
  let helper: Caller;

  beforeEach(async () => {
    const owner = await addUser(api.db, 'owner@example.com', Date.now());
    person = caller(() => api.app, owner.person);
    helper = caller(() => api.app, owner.helper);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await helper('PUT', `/api/runners/${runner}`, helperName('Mac'));
  });

  async function answered(batches: RunStepInput[][]) {
    const chat = await person<ChatDetail>('POST', '/api/projects/MOB/chats', {
      runnerId: runner,
      text: 'Fix the crash',
    });
    const { run } = (await helper<RunJob>('POST', `/api/runners/${runner}/next?kind=ask`)).body;
    for (const steps of batches) {
      await helper('POST', `/api/runs/${run.id}/steps`, { runnerId: runner, steps });
    }
    const steps = (await person<RunStep[]>('GET', `/api/runs/${run.id}/steps`)).body;
    await helper('POST', `/api/runs/${run.id}/finish`, { status: 'done', answer: 'Fixed.' });
    const { messages } = (await person<ChatDetail>('GET', `/api/chats/${chat.body.chat.id}`)).body;
    return { steps, answer: messages.at(-1) };
  }

  it('keeps only the latest list, and an earlier call reads back with none', async () => {
    const { steps, answer } = await answered([
      [todoStep(first, 'toolu_1'), readStep, todoStep(first, 'toolu_2')],
      [readStep, todoStep(last, 'toolu_3')],
    ]);
    expect(steps.map(({ todos }) => todos)).toEqual([[], undefined, [], undefined, last]);
    expect(answer?.todos).toEqual(last);
    expect(answer?.stepCount).toBe(5);
  });

  it('leaves the list out of steps and an answer that had none', async () => {
    const { steps, answer } = await answered([[readStep]]);
    expect(steps[0]).not.toHaveProperty('todos');
    expect(answer).not.toHaveProperty('todos');
  });

  it('keeps no list on the answer when Claude emptied it last', async () => {
    const { answer } = await answered([[todoStep(first, 'toolu_1')], [todoStep([], 'toolu_2')]]);
    expect(answer).not.toHaveProperty('todos');
  });
});
