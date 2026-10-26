import { randomUUID } from 'node:crypto';
import {
  BATCH_NEEDS_NEW_HELPER,
  type Run,
  type RunActivity,
  type RunAllPreview,
  type RunAllResult,
  type RunBatch,
  type RunJob,
} from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

describe.each(DIALECTS)('run all todo (%s)', (dialect) => {
  const api = useTestServer(dialect);
  let person: Caller;
  let helper: Caller;
  const runner = randomUUID();

  const runAll = () =>
    person<RunAllResult>('POST', '/api/projects/MOB/run-all', { runnerId: runner });
  const register = (id: string) =>
    helper('PUT', `/api/runners/${id}`, { ...helperName(id), projectKeys: ['MOB'] });
  const start = (ticket: string, runnerId: string) =>
    person<Run>('POST', `/api/tickets/${ticket}/runs`, { runnerId, prompt: `Do ${ticket}` });
  const take = (id: string) =>
    helper<{ run: Run } | null>('POST', `/api/runners/${id}/next?kind=ticket&batches=1`);

  beforeEach(async () => {
    const mine = await addUser(api.db, 'a@example.com', Date.now());
    person = caller(() => api.app, mine.person);
    helper = caller(() => api.app, mine.helper);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    for (const title of ['Crash', 'Login', 'Search', 'Share']) {
      await person('POST', '/api/projects/MOB/tickets', { title });
    }
    await register(runner);
  });

  describe('Run all Todo', () => {
    const batchOf = (id: string | null) => person<RunBatch>('GET', `/api/runs/${id}/batch`);
    const ticketRuns = async (key: string) =>
      (await person<Run[]>('GET', `/api/tickets/${key}/runs`)).body;

    it('queues one batch run that holds every Todo ticket', async () => {
      const { status, body } = await runAll();
      expect(status).toBe(201);
      expect(body).toEqual({
        runId: expect.any(String),
        queued: 4,
        skippedActive: 0,
        skippedDevice: 0,
        leftOver: 0,
        maxParallel: null,
      });
      const batch = (await batchOf(body.runId)).body;
      expect(batch.tickets.map(({ ticketKey, state }) => [ticketKey, state])).toEqual([
        ['MOB-1', 'waiting'],
        ['MOB-2', 'waiting'],
        ['MOB-3', 'waiting'],
        ['MOB-4', 'waiting'],
      ]);
      const held = await ticketRuns('MOB-1');
      expect(held.map(({ status: s, batchId }) => [s, batchId])).toEqual([['queued', body.runId]]);
    });

    it('gives the helper one run with the tickets and no fixed sub agent number', async () => {
      const { body } = await runAll();
      const job = (await take(runner)).body as RunJob;
      expect(job.run).toMatchObject({ id: body.runId, kind: 'batch', ticketKey: null });
      expect(job.ticketKeys).toEqual(['MOB-1', 'MOB-2', 'MOB-3', 'MOB-4']);
      expect(job.prompt).toContain('Decide how many sub agents to run at once');
      expect(job.prompt).not.toMatch(/at most \d/);
      expect(job.prompt).toContain('- MOB-3 · Medium · Search');
    });

    it('takes a lower limit for one batch', async () => {
      const { body } = await person<RunAllResult>('POST', '/api/projects/MOB/run-all', {
        runnerId: runner,
        maxParallel: 3,
      });
      expect(body.maxParallel).toBe(3);
      expect(((await take(runner)).body as RunJob).prompt).toContain('Run at most 3 sub agents');
    });

    it('ignores the old project limit fields an older client sends', async () => {
      const old = { maxParallelRuns: 2, maxSubAgents: 1 };
      expect((await person('PATCH', '/api/projects/MOB', old)).status).toBe(200);
      expect((await runAll()).body.maxParallel).toBeNull();
    });

    it('holds at most 30 tickets and leaves the rest for the next Run all', async () => {
      for (let n = 5; n <= 33; n += 1) {
        await person('POST', '/api/projects/MOB/tickets', { title: `Ticket ${n}` });
      }
      const { body } = await runAll();
      expect(body).toMatchObject({ queued: 30, leftOver: 3 });
      expect((await runAll()).body).toMatchObject({ queued: 3, skippedActive: 30, leftOver: 0 });
    });

    it('ends a batch an old helper takes, with why, rather than hand it out', async () => {
      const { body } = await runAll();
      const old = await helper('POST', `/api/runners/${runner}/next?kind=ticket`);
      expect(old.status).toBe(204);
      const ended = (await person<Run>('GET', `/api/runs/${body.runId}`)).body;
      expect(ended).toMatchObject({ status: 'failed', error: BATCH_NEEDS_NEW_HELPER });
      expect((await start('MOB-1', runner)).status).toBe(201);
    });

    it('refuses more than 5 sub agents at once', async () => {
      const tooMany = { runnerId: runner, maxParallel: 6 };
      expect((await person('POST', '/api/projects/MOB/run-all', tooMany)).status).toBe(400);
    });

    it('never gives out a ticket the batch holds as a run of its own', async () => {
      await runAll();
      const other = randomUUID();
      await register(other);
      expect(((await take(runner)).body as RunJob).run.kind).toBe('batch');
      expect((await take(other)).status).toBe(204);
    });

    it('queues no ticket twice when tapped again', async () => {
      await runAll();
      const again = await runAll();
      expect(again.body).toMatchObject({ runId: null, queued: 0, skippedActive: 4 });
      expect(await ticketRuns('MOB-1')).toHaveLength(1);
    });

    it('queues no ticket twice when two taps race', async () => {
      const taps = await Promise.all([runAll(), runAll()]);
      const queued = taps.reduce((sum, tap) => sum + (tap.status === 201 ? tap.body.queued : 0), 0);
      expect(queued).toBe(4);
      for (const key of ['MOB-1', 'MOB-2', 'MOB-3', 'MOB-4']) {
        expect(await ticketRuns(key)).toHaveLength(1);
      }
    });

    it('refuses a run of its own for a ticket the batch holds', async () => {
      await runAll();
      expect((await start('MOB-2', runner)).status).toBe(409);
    });

    it('skips a ticket that needs a device', async () => {
      await person('PATCH', '/api/tickets/MOB-2', { needsDevice: true });
      const { body } = await runAll();
      expect(body).toMatchObject({ queued: 3, skippedActive: 0, skippedDevice: 1 });
      expect(await ticketRuns('MOB-2')).toEqual([]);
    });

    it('skips a ticket that is not in Todo', async () => {
      const board = (
        await person<{ statuses: { id: string; category: string }[] }>(
          'GET',
          '/api/projects/MOB/board',
        )
      ).body;
      const doing = board.statuses.find((status) => status.category === 'in_progress');
      await person('PATCH', '/api/tickets/MOB-1', { statusId: doing?.id });
      expect((await runAll()).body.queued).toBe(3);
    });

    it('shows what Run all would queue before it starts', async () => {
      await person('PATCH', '/api/tickets/MOB-2', { needsDevice: true });
      await start('MOB-3', runner);
      const { body } = await person<RunAllPreview>('GET', '/api/projects/MOB/run-all');
      expect(body).toEqual({
        tickets: [
          { ticketKey: 'MOB-1', ticketTitle: 'Crash' },
          { ticketKey: 'MOB-4', ticketTitle: 'Share' },
        ],
        skippedActive: 1,
        skippedDevice: 1,
        leftOver: 0,
        maxParallel: 5,
      });
      expect(await ticketRuns('MOB-1')).toEqual([]);
    });

    it('keeps a ticket the batch holds while it waits, whatever it is moved to', async () => {
      const queued = (await runAll()).body.runId;
      await helper('POST', '/api/tickets/MOB-4/claim');
      await take(runner);
      const tickets = (await person<RunBatch>('GET', `/api/runs/${queued}/batch`)).body.tickets;
      expect(tickets.map(({ state }) => state)).toEqual([
        'waiting',
        'waiting',
        'waiting',
        'waiting',
      ]);
      expect((await start('MOB-4', runner)).status).toBe(409);
    });

    it('refuses a computer that does not run the project', async () => {
      const { status } = await person('POST', '/api/projects/MOB/run-all', {
        runnerId: randomUUID(),
      });
      expect(status).toBe(404);
    });
  });

  describe('a batch at work', () => {
    let batchId: string;
    const states = async () =>
      (await person<RunBatch>('GET', `/api/runs/${batchId}/batch`)).body.tickets.map(
        ({ state }) => state,
      );
    const finish = (status: string) =>
      helper('POST', `/api/runs/${batchId}/finish`, { status, error: 'Stopped' });

    beforeEach(async () => {
      batchId = (await runAll()).body.runId as string;
      await take(runner);
    });

    it('follows each ticket as a sub agent claims and submits it', async () => {
      await helper('POST', '/api/tickets/MOB-1/claim');
      await helper('POST', '/api/tickets/MOB-2/claim');
      expect(await states()).toEqual(['running', 'running', 'waiting', 'waiting']);
      await helper('POST', '/api/tickets/MOB-1/submit', { summary: 'Fixed', files: '', next: '' });
      expect(await states()).toEqual(['done', 'running', 'waiting', 'waiting']);
      expect((await person<Run>('GET', `/api/runs/${batchId}`)).body.status).toBe('running');
    });

    it('fails what the batch did not finish and keeps what it did', async () => {
      await helper('POST', '/api/tickets/MOB-1/claim');
      await helper('POST', '/api/tickets/MOB-1/submit', { summary: 'Fixed', files: '', next: '' });
      expect((await helper('POST', `/api/runs/${batchId}/finish`, { status: 'done' })).status).toBe(
        200,
      );
      expect(await states()).toEqual(['done', 'failed', 'failed', 'failed']);
      expect((await person<Run>('GET', `/api/runs/${batchId}`)).body.status).toBe('done');
      expect((await start('MOB-2', runner)).status).toBe(201);
    });

    it('lists the batch on the Activity screen with its count and failed tickets', async () => {
      await helper('POST', '/api/tickets/MOB-1/claim');
      await helper('POST', '/api/tickets/MOB-1/submit', { summary: 'Fixed', files: '', next: '' });
      const running = (await person<RunActivity>('GET', '/api/run-activity')).body.batches;
      expect(running).toMatchObject([{ runId: batchId, state: 'running', total: 4, done: 1 }]);
      await finish('failed');
      const ended = (await person<RunActivity>('GET', '/api/run-activity')).body.batches;
      expect(ended).toMatchObject([
        { runId: batchId, state: 'failed', failedKeys: ['MOB-2', 'MOB-3', 'MOB-4'] },
      ]);
    });

    it('stops the whole batch on Cancel', async () => {
      expect((await person('POST', `/api/runs/${batchId}/cancel`)).status).toBe(200);
      expect(await states()).toEqual(['cancelled', 'cancelled', 'cancelled', 'cancelled']);
    });

    it("refuses to cancel one ticket's run in the batch", async () => {
      const [held] = (await person<Run[]>('GET', '/api/tickets/MOB-1/runs')).body;
      expect((await person('POST', `/api/runs/${held?.id}/cancel`)).status).toBe(409);
    });

    it('counts the batch once toward the project limit, not its sub agents', async () => {
      await helper('POST', '/api/tickets/MOB-1/claim');
      await helper('POST', '/api/tickets/MOB-2/claim');
      await person('POST', '/api/projects/MOB/tickets', { title: 'Later' });
      const other = randomUUID();
      await register(other);
      await start('MOB-5', other);
      expect((await take(other)).status).toBe(200);
    });

    it('ends the held tickets when the helper restarts', async () => {
      await helper('POST', '/api/tickets/MOB-1/claim');
      await take(runner);
      expect(await states()).toEqual(['failed', 'failed', 'failed', 'failed']);
    });
  });

  describe('parallel limit', () => {
    const runners = Array.from({ length: 6 }, () => randomUUID());

    beforeEach(async () => {
      for (const id of runners) await register(id);
      await person('POST', '/api/projects/MOB/tickets', { title: 'Five' });
      await person('POST', '/api/projects/MOB/tickets', { title: 'Six' });
      for (const [index, id] of runners.entries()) await start(`MOB-${index + 1}`, id);
    });

    it('gives out runs only while fewer than the limit of 5 are running', async () => {
      for (const id of runners.slice(0, 5)) expect((await take(id)).status).toBe(200);
      expect((await take(runners[5] as string)).status).toBe(204);
    });

    it('starts a waiting run when a running one ends', async () => {
      const first = (await take(runners[0] as string)).body;
      for (const id of runners.slice(1, 5)) await take(id);
      expect((await take(runners[5] as string)).status).toBe(204);
      await helper('POST', `/api/runs/${first?.run.id}/finish`, { status: 'done' });
      expect((await take(runners[5] as string)).status).toBe(200);
    });
  });
});
