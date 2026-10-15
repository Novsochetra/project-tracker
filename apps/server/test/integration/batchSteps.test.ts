import { randomUUID } from 'node:crypto';
import {
  RUN_STEPS_BATCH_MAX,
  RUN_STEPS_KEPT,
  type RunAllResult,
  type RunBatch,
  type RunStep,
  type RunStepInput,
} from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addUser, caller, helperName, type Auth, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

describe.each(DIALECTS)("a batch's steps on its tickets (%s)", (dialect) => {
  const api = useTestServer(dialect);
  let person: Caller;
  let personAuth: Auth;
  const readers: ReadableStreamDefaultReader<Uint8Array>[] = [];
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
    personAuth = mine.person;
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

  afterEach(async () => {
    await Promise.all(readers.splice(0).map((reader) => reader.cancel()));
  });

  async function readUntil(reader: ReadableStreamDefaultReader<Uint8Array>, pattern: RegExp) {
    const decoder = new TextDecoder();
    let text = '';
    while (!pattern.test(text)) {
      const chunk = await reader.read();
      if (chunk.done) throw new Error(`Stream ended before ${String(pattern)}: ${text}`);
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text;
  }

  it("tells the ticket's screen of its new steps with a step event of its own run", async () => {
    const headers: Record<string, string> = personAuth.token
      ? { authorization: `Bearer ${personAuth.token}` }
      : { cookie: personAuth.cookie ?? '' };
    const reader = (await api.app.request('/api/events', { headers })).body!.getReader();
    readers.push(reader);
    await readUntil(reader, /: connected\n\n/);
    await send([start('toolu_a', 'MOB-2 login')]);
    const ticketRun = ticketRuns.get('MOB-2') ?? '';
    const text = await readUntil(reader, new RegExp(`"runId":"${ticketRun}"`));
    expect(text).toMatch(new RegExp(`event: run-step\ndata: .*"runId":"${ticketRun}".*"count":1`));
  });

  it('keeps a ticket tied to its sub agent past the steps a run keeps', async () => {
    await send([start('toolu_a', 'MOB-1')]);
    await helper('POST', '/api/tickets/MOB-1/claim');
    const sent = RUN_STEPS_KEPT + RUN_STEPS_BATCH_MAX;
    for (let at = 0; at < sent; at += RUN_STEPS_BATCH_MAX) {
      const steps = Array.from({ length: RUN_STEPS_BATCH_MAX }, (_, i) =>
        sub('toolu_a', `Read file-${at + i}.ts`),
      );
      expect((await send(steps)).status).toBe(204);
    }
    await send([sub('toolu_a', 'Run npm test')]);
    const shown = await labels(ticketRuns.get('MOB-1'));
    expect(shown).toHaveLength(RUN_STEPS_KEPT);
    expect(shown.at(-1)).toBe('Run npm test');
    const rows = await api.db
      .selectFrom('runSteps')
      .select('label')
      .where('runId', '=', ticketRuns.get('MOB-1') ?? '')
      .where('kind', '=', 'agent')
      .execute();
    expect(rows.map(({ label }) => label)).toEqual(['Start sub agent: MOB-1']);
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
