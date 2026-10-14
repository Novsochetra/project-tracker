import { randomUUID } from 'node:crypto';
import {
  RUN_DIFF_MAX,
  type Activity,
  type PromptResult,
  type Run,
  type TicketChangesAnswer,
  type TicketDetail,
} from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

const DIFF = [
  'diff --git a/src/a.ts b/src/a.ts',
  '--- a/src/a.ts',
  '+++ b/src/a.ts',
  '@@ -1,2 +1,2 @@',
  ' const x = 1;',
  '-const y = 2;',
  '+const y = 3;',
  '',
].join('\n');

describe.each(DIALECTS)('run changes (%s)', (dialect) => {
  const api = useTestServer(dialect);
  let person: Caller;
  let helper: Caller;
  let other: { person: Caller; helper: Caller };
  let runner: string;
  let run: Run;

  const send = (body: object, as = helper) =>
    as('POST', `/api/runs/${run.id}/changes`, {
      runnerId: runner,
      diff: DIFF,
      cut: false,
      ...body,
    });
  const read = (as = person) => as<TicketChangesAnswer>('GET', '/api/tickets/MOB-1/changes');
  const take = () => helper('POST', `/api/runners/${runner}/next`);
  const finish = () => helper('POST', `/api/runs/${run.id}/finish`, { status: 'done' });

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

  it("keeps a running run's changes for the ticket, and none before", async () => {
    expect((await read()).body).toEqual({ changes: null });
    await take();
    expect((await send({ cut: true })).status).toBe(204);
    await finish();
    expect((await read()).body).toEqual({
      changes: {
        runId: run.id,
        diff: DIFF,
        cut: true,
        createdAt: expect.any(Number) as number,
        verdict: null,
        viewed: {},
      },
    });
  });

  it('takes changes only from the helper that took the run, while it runs', async () => {
    expect(await send({})).toMatchObject({
      status: 409,
      body: { error: { message: 'This run is not running (queued).' } },
    });
    await take();
    expect((await send({}, person)).status).toBe(403);
    expect((await send({}, other.helper)).status).toBe(404);
    const wrong = await helper('POST', `/api/runs/${run.id}/changes`, {
      runnerId: randomUUID(),
      diff: DIFF,
      cut: false,
    });
    expect(wrong.status).toBe(403);
    expect((await send({ diff: 'x'.repeat(RUN_DIFF_MAX + 1) })).status).toBe(400);
    await finish();
    expect((await send({})).status).toBe(409);
    expect((await read()).body.changes).toBeNull();
    expect((await read(other.person)).status).toBe(404);
  });

  it('keeps viewed ticks per file with their digest, for a person only', async () => {
    await take();
    await send({});
    const tick = (body: object, as = person) =>
      as('PUT', '/api/tickets/MOB-1/changes/viewed', body);
    expect((await tick({ path: 'src/a.ts', digest: 'd1', viewed: true })).status).toBe(204);
    expect((await read()).body.changes?.viewed).toEqual({ 'src/a.ts': 'd1' });
    await tick({ path: 'src/a.ts', digest: 'd3', viewed: true });
    expect((await read()).body.changes?.viewed).toEqual({ 'src/a.ts': 'd3' });
    await tick({ path: 'src/a.ts', digest: 'd3', viewed: false });
    expect((await read()).body.changes?.viewed).toEqual({});
    expect((await tick({ path: 'src/b.ts', digest: 'd2', viewed: true })).status).toBe(404);
    expect((await tick({ path: 'src/a.ts', digest: 'd2', viewed: true }, helper)).status).toBe(403);
    expect((await tick({ path: 'x', digest: 'd', viewed: true }, other.person)).status).toBe(404);
  });

  it('keeps the line a comment is on, and gives it to the next prompt', async () => {
    await take();
    await send({});
    const line = { runId: run.id, path: 'src/a.ts', side: 'new', line: 2 };
    const comment = await person<Activity>('POST', '/api/tickets/MOB-1/comments', {
      text: 'Use 4 here.',
      line,
    });
    expect(comment.status).toBe(201);
    expect(comment.body.line).toEqual(line);
    const plain = await person<Activity>('POST', '/api/tickets/MOB-1/comments', { text: 'Hi' });
    expect(plain.body).not.toHaveProperty('line');
    const detail = await person<TicketDetail>('GET', '/api/tickets/MOB-1');
    expect(detail.body.activity.find((item) => item.id === comment.body.id)?.line).toEqual(line);
    const prompt = await person<PromptResult>('GET', '/api/tickets/MOB-1/prompt');
    expect(prompt.body.text).toContain('- On src/a.ts line 2: Use 4 here.');
    const elsewhere = await person('POST', '/api/tickets/MOB-1/comments', {
      text: 'Nope',
      line: { ...line, runId: randomUUID() },
    });
    expect(elsewhere.status).toBe(404);
  });

  it('approves or asks for changes on the latest changes only, for a person only', async () => {
    await take();
    await send({});
    await helper('POST', '/api/tickets/MOB-1/submit', { summary: 'Fixed.' });
    const verdict = (body: object, as = person) =>
      as<TicketDetail>('POST', '/api/tickets/MOB-1/changes/verdict', body);
    expect((await verdict({ runId: run.id, verdict: 'approved' }, helper)).status).toBe(403);
    expect((await verdict({ runId: randomUUID(), verdict: 'approved' })).status).toBe(409);
    const approved = await verdict({ runId: run.id, verdict: 'approved' });
    expect(approved.body.status.name).toBe('Reviewed');
    expect(approved.body.activity.at(-1)?.text).toBe(
      'approved the changes and moved it to Reviewed',
    );
    const asked = await verdict({ runId: run.id, verdict: 'changes_requested' });
    expect(asked.body.status.name).toBe('To do');
    expect(asked.body.activity.at(-1)?.text).toBe('asked for changes and moved it to To do');
    expect((await read()).body.changes?.verdict).toBe('changes_requested');
  });
});
