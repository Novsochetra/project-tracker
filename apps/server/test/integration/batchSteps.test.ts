import { randomUUID } from 'node:crypto';
import type { RunAllResult, RunBatch, RunStep, RunStepInput } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

describe.each(DIALECTS)("a batch's steps on its tickets (%s)", (dialect) => {
  const api = useTestServer(dialect);
  let person: Caller;
  let helper: Caller;
  let batchId: string;
  let ticketRuns: Map<string, string>;
  const runner = randomUUID();

  const send = (steps: Partial<RunStepInput>[]) =>
    helper('POST', `/api/runs/${batchId}/steps`, { runnerId: runner, steps });
  const labels = async (runId: string | undefined) =>
    (await person<RunStep[]>('GET', `/api/runs/${runId}/steps`)).body.map(
      ({ label, subAgent }) => `${subAgent ? '  ' : ''}${label}`,
    );
  const start = (toolId: string, description: string) => ({
    kind: 'agent' as const,
    label: `Start sub agent: ${description}`,
    toolId,
  });
  const sub = (parentToolId: string, label: string) => ({
    kind: 'tool' as const,
    label,
    subAgent: true,
    parentToolId,
    toolId: randomUUID(),
  });

  beforeEach(async () => {
    const mine = await addUser(api.db, 'a@example.com', Date.now());
    person = caller(() => api.app, mine.person);
    helper = caller(() => api.app, mine.helper);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    for (const title of ['Crash', 'Login']) {
      await person('POST', '/api/projects/MOB/tickets', { title });
    }
    await helper('PUT', `/api/runners/${runner}`, { ...helperName(runner), projectKeys: ['MOB'] });
    const all = await person<RunAllResult>('POST', '/api/projects/MOB/run-all', {
      runnerId: runner,
    });
    batchId = all.body.runId ?? '';
    await helper('POST', `/api/runners/${runner}/next?kind=ticket&batches=1`);
    const batch = (await person<RunBatch>('GET', `/api/runs/${batchId}/batch`)).body;
    ticketRuns = new Map(batch.tickets.map(({ ticketKey, runId }) => [ticketKey, runId]));
  });

  it("gives each sub agent's steps to its own ticket and keeps them all on the batch", async () => {
    expect((await send([start('toolu_a', 'MOB-1 crash'), start('toolu_b', 'Next')])).status).toBe(
      204,
    );
    await send([
      sub('toolu_a', 'Use tracker: claim_ticket MOB-1'),
      sub('toolu_b', 'Use tracker: claim_ticket MOB-2'),
    ]);
    await helper('POST', '/api/tickets/MOB-1/claim');
    await send([sub('toolu_a', 'Read src/crash.ts'), sub('toolu_b', 'Read src/login.ts')]);
    expect(await labels(ticketRuns.get('MOB-1'))).toEqual([
      'Start sub agent: MOB-1 crash',
      'Use tracker: claim_ticket MOB-1',
      'Read src/crash.ts',
    ]);
    expect(await labels(ticketRuns.get('MOB-2'))).toEqual([
      'Start sub agent: Next',
      'Use tracker: claim_ticket MOB-2',
      'Read src/login.ts',
    ]);
    expect(await labels(batchId)).toHaveLength(6);
  });

  it('keeps steps on the batch alone once their ticket is submitted', async () => {
    await send([start('toolu_a', 'MOB-1')]);
    await helper('POST', '/api/tickets/MOB-1/claim');
    await helper('POST', '/api/tickets/MOB-1/submit', { summary: 'Fixed', files: '', next: '' });
    expect((await send([sub('toolu_a', 'Done, MOB-1 is in review.')])).status).toBe(204);
    expect(await labels(ticketRuns.get('MOB-1'))).toEqual(['Start sub agent: MOB-1']);
    expect(await labels(batchId)).toEqual([
      'Start sub agent: MOB-1',
      '  Done, MOB-1 is in review.',
    ]);
  });
});
