import { randomUUID } from 'node:crypto';
import {
  RUN_STEP_LABEL_MAX,
  RUN_STEP_TEXT_MAX,
  RUN_STEPS_BATCH_MAX,
  RUN_STEPS_KEPT,
  type Run,
  type RunStep,
  type RunStepInput,
} from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

const step = (label: string, kind: RunStepInput['kind'] = 'tool'): RunStepInput => ({
  kind,
  label,
  subAgent: false,
  toolId: kind === 'text' ? null : `toolu_${label.length}`,
});

const batch = (from: number, size: number) =>
  Array.from({ length: size }, (_, index) => step(`Read ${from + index}.ts`));

describe.each(DIALECTS)('run steps (%s)', (dialect) => {
  const api = useTestServer(dialect);
  let person: Caller;
  let helper: Caller;
  let other: { person: Caller; helper: Caller };
  let runner: string;
  let run: Run;

  const send = (steps: RunStepInput[], as = helper, runnerId = runner) =>
    as('POST', `/api/runs/${run.id}/steps`, { runnerId, steps });
  const read = (query = '', as = person) =>
    as<RunStep[]>('GET', `/api/runs/${run.id}/steps${query}`);

  beforeEach(async () => {
    const a = await addUser(api.db, 'a@example.com', Date.now());
    const b = await addUser(api.db, 'b@example.com', Date.now() + 1);
    person = caller(() => api.app, a.person);
    helper = caller(() => api.app, a.helper);
    other = { person: caller(() => api.app, b.person), helper: caller(() => api.app, b.helper) };
    runner = randomUUID();
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await person('POST', '/api/projects/MOB/tickets', { title: 'Crash' });
    await helper('PUT', `/api/runners/${runner}`, helperName('A Mac'));
    run = (await person<Run>('POST', '/api/tickets/MOB-1/runs', { runnerId: runner, prompt: 'Go' }))
      .body;
  });

  const take = () => helper('POST', `/api/runners/${runner}/next`);

  it('keeps the steps the helper sends, in order, for the person to read', async () => {
    await take();
    const grep = { ...step('Use Grep'), subAgent: true, toolId: 'toolu_g' };
    expect((await send([step('Read a.ts'), grep])).status).toBe(204);
    const denied = { kind: 'denied' as const, label: 'Not allowed: Use Grep', toolId: 'toolu_g' };
    expect((await send([step('Done.', 'text'), { ...denied, subAgent: true }])).status).toBe(204);
    const { status, body } = await read();
    expect(status).toBe(200);
    const at = expect.any(Number) as number;
    expect(body).toEqual([
      { seq: 1, kind: 'tool', label: 'Read a.ts', subAgent: false, toolId: 'toolu_9', at },
      { seq: 2, kind: 'tool', label: 'Use Grep', subAgent: true, toolId: 'toolu_g', at },
      { seq: 3, kind: 'text', label: 'Done.', subAgent: false, toolId: null, at },
      { seq: 4, ...denied, subAgent: true, at },
    ]);
    expect((await read('?after=2')).body.map(({ seq }) => seq)).toEqual([3, 4]);
    expect((await person<Run>('GET', `/api/runs/${run.id}`)).body.stepCount).toBe(4);
  });

  it('takes steps only from the helper that took the run', async () => {
    await take();
    const fromPerson = await send([step('Read a.ts')], person);
    expect(fromPerson.status).toBe(403);
    const otherRunner = randomUUID();
    await helper('PUT', `/api/runners/${otherRunner}`, helperName('A iMac'));
    expect(await send([step('Read a.ts')], helper, otherRunner)).toEqual({
      status: 403,
      body: {
        error: {
          code: 'forbidden',
          message: 'Only the helper that took this run sends its steps.',
        },
      },
    });
    expect((await read()).body).toEqual([]);
  });

  it('shows the steps to a person only', async () => {
    await take();
    await send([step('Read a.ts')]);
    expect((await read('', helper)).status).toBe(403);
  });

  it("answers 404 for another user's run, both ways", async () => {
    await take();
    expect((await send([step('Read a.ts')], other.helper)).status).toBe(404);
    expect((await read('', other.person)).status).toBe(404);
    expect((await read()).body).toEqual([]);
  });

  it('refuses steps before the run is taken and after it ended, and keeps the ones it has', async () => {
    expect(await send([step('Read a.ts')])).toMatchObject({
      status: 409,
      body: { error: { message: 'This run has not started yet.' } },
    });
    await take();
    await send([step('Read a.ts')]);
    await helper('POST', `/api/runs/${run.id}/finish`, { status: 'done' });
    expect(await send([step('Read b.ts')])).toMatchObject({
      status: 409,
      body: { error: { message: 'This run already ended (done).' } },
    });
    expect((await read()).body.map(({ label }) => label)).toEqual(['Read a.ts']);
  });

  it('keeps only the newest steps past the cap, numbered as they came', async () => {
    await take();
    const total = RUN_STEPS_KEPT + RUN_STEPS_BATCH_MAX;
    for (let from = 1; from <= total; from += RUN_STEPS_BATCH_MAX) {
      expect((await send(batch(from, RUN_STEPS_BATCH_MAX))).status).toBe(204);
    }
    const { body } = await read();
    expect(body).toHaveLength(RUN_STEPS_KEPT);
    expect(body[0]).toMatchObject({ seq: RUN_STEPS_BATCH_MAX + 1, label: 'Read 101.ts' });
    expect(body.at(-1)).toMatchObject({ seq: total, label: `Read ${total}.ts` });
    const rows = await api.db.selectFrom('runSteps').select('seq').execute();
    expect(rows).toHaveLength(RUN_STEPS_KEPT);
  });

  it('refuses oversized labels and batches', async () => {
    await take();
    const long = 'x'.repeat(RUN_STEP_LABEL_MAX + 1);
    expect((await send([step(long)])).status).toBe(400);
    expect((await send([step(long, 'agent')])).status).toBe(400);
    expect((await send([step('y'.repeat(RUN_STEP_TEXT_MAX + 1), 'text')])).status).toBe(400);
    expect((await send([step(long, 'text')])).status).toBe(204);
    expect((await send([])).status).toBe(400);
    expect((await send(batch(1, RUN_STEPS_BATCH_MAX + 1))).status).toBe(400);
    expect((await send([{ ...step('Read a.ts'), kind: 'output' as 'tool' }])).status).toBe(400);
    expect((await read('?after=-1')).status).toBe(400);
    expect((await read('?after=99999999999')).status).toBe(400);
  });

  it('goes with its run', async () => {
    await take();
    await send([step('Read a.ts')]);
    expect((await person('DELETE', '/api/tickets/MOB-1')).status).toBe(204);
    expect(await api.db.selectFrom('runSteps').selectAll().execute()).toEqual([]);
  });
});
