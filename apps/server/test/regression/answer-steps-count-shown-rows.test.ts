import { randomUUID } from 'node:crypto';
import {
  withoutAnswer,
  type ChatDetail,
  type RunJob,
  type RunStep,
  type RunStepInput,
} from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

const read = (label: string): RunStepInput => ({
  kind: 'tool',
  label,
  subAgent: false,
  toolId: null,
});
const words = (label: string, subAgent = false): RunStepInput => ({
  kind: 'text',
  label,
  subAgent,
  toolId: null,
});

// PT-170: "2 steps" above an answer opened 1 row, since the open list leaves out Claude's last
// words, which are the answer right under it, and the count did not.
describe.each(DIALECTS)('regression: an answer counts the steps it shows (%s)', (dialect) => {
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

  async function answered(steps: RunStepInput[], answer: string) {
    const chat = await person<ChatDetail>('POST', '/api/projects/MOB/chats', {
      runnerId: runner,
      text: 'Where are runs queued?',
    });
    const job = (await helper<RunJob>('POST', `/api/runners/${runner}/next?kind=ask`)).body;
    await helper('POST', `/api/runs/${job.run.id}/steps`, { runnerId: runner, steps });
    await helper('POST', `/api/runs/${job.run.id}/finish`, { status: 'done', answer });
    const { messages } = (await person<ChatDetail>('GET', `/api/chats/${chat.body.chat.id}`)).body;
    const message = messages.at(-1);
    const shown = await person<RunStep[]>('GET', `/api/runs/${job.run.id}/steps`);
    return { count: message?.stepCount, rows: withoutAnswer(shown.body, answer).length };
  }

  it("leaves the answer's own words out of the count, as the open list does", async () => {
    const answer = 'Runs are queued in runQueue.ts.';
    expect(await answered([read('Read runQueue.ts'), words(answer)], answer)).toEqual({
      count: 1,
      rows: 1,
    });
    expect(await answered([read('Read a.ts'), words('Runs are queued…')], answer)).toEqual({
      count: 1,
      rows: 1,
    });
  });

  it('counts last words that are not the answer', async () => {
    const answer = 'In runQueue.ts.';
    expect(await answered([read('Read a.ts'), words('Something else.')], answer)).toEqual({
      count: 2,
      rows: 2,
    });
    expect(await answered([read('Read a.ts'), words(answer, true)], answer)).toEqual({
      count: 2,
      rows: 2,
    });
    expect(await answered([words(answer), read('Read a.ts')], answer)).toEqual({
      count: 2,
      rows: 2,
    });
  });
});
