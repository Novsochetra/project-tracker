import { randomUUID } from 'node:crypto';
import {
  RUNNER_ONLINE_MS,
  type Project,
  type ProjectDetail,
  type Run,
  type RunJob,
  type TicketDetail,
} from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { testClock } from '../helpers/auth';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

describe.each(DIALECTS)('review automatically (%s)', (dialect) => {
  const clock = testClock();
  const api = useTestServer(dialect, { now: clock.now });
  const runner = randomUUID();
  let person: Caller;
  let helper: Caller;

  const setAutoReview = (autoReview: boolean, as: Caller = person) =>
    as<Project>('PATCH', '/api/projects/MOB', { autoReview });
  const start = () =>
    person<Run>('POST', '/api/tickets/MOB-1/runs', { runnerId: runner, prompt: 'Work on MOB-1' });
  const take = async () => {
    clock.advance(1_000);
    const job = await helper<RunJob | null>('POST', `/api/runners/${runner}/next`);
    return job.body;
  };
  const finish = (id: string, status = 'done') =>
    helper<Run>('POST', `/api/runs/${id}/finish`, { status });
  const runs = async () => (await person<Run[]>('GET', '/api/tickets/MOB-1/runs')).body;
  const statusOf = async () =>
    (await person<TicketDetail>('GET', '/api/tickets/MOB-1')).body.status.name;

  // What Claude does through the tracker's tools, as an agent.
  const work = () => helper('POST', '/api/tickets/MOB-1/submit', { summary: 'Fixed the crash.' });
  const review = (verdict: 'approved' | 'changes_requested') =>
    helper('POST', '/api/tickets/MOB-1/review', { verdict, rating: 3, summary: 'Add a test.' });

  async function workRound(): Promise<RunJob> {
    const job = await take();
    if (!job) throw new Error('No work run was queued.');
    await work();
    await finish(job.run.id);
    return job;
  }

  beforeEach(async () => {
    clock.set(1_000_000);
    const owner = await addUser(api.db, 'owner@example.com', clock.now());
    person = caller(() => api.app, owner.person);
    helper = caller(() => api.app, owner.helper);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    await person('POST', '/api/projects/MOB/tickets', { title: 'Crash' });
    await helper('PUT', `/api/runners/${runner}`, helperName('Dara’s MacBook'));
  });

  it('is off by default, and then a run that ends in review queues nothing', async () => {
    expect((await person<ProjectDetail>('GET', '/api/projects/MOB')).body.project).toMatchObject({
      autoReview: false,
    });
    await start();
    await workRound();
    expect(await statusOf()).toBe('Need review');
    expect((await runs()).map((run) => [run.role, run.status, run.chainStop])).toEqual([
      ['work', 'done', null],
    ]);
  });

  it('lets only a person turn it on or off', async () => {
    expect((await setAutoReview(true, helper)).status).toBe(403);
    expect((await setAutoReview(true)).body).toMatchObject({ autoReview: true });
    expect((await setAutoReview(false)).body).toMatchObject({ autoReview: false });
  });

  it('reviews work that reached review on the same helper, and ends in Reviewed', async () => {
    await setAutoReview(true);
    await start();
    await workRound();
    const reviewJob = await take();
    expect(reviewJob?.run).toMatchObject({ role: 'review', runnerId: runner, ticketKey: 'MOB-1' });
    expect(reviewJob?.prompt).toContain('Please review the work on ticket MOB-1');
    expect(reviewJob?.prompt).toContain('Fixed the crash.');
    await review('approved');
    await finish(reviewJob?.run.id ?? '');

    expect(await take()).toBeNull();
    expect(await statusOf()).toBe('Reviewed');
    expect((await runs()).map((run) => [run.role, run.status, run.chainStop])).toEqual([
      ['review', 'done', null],
      ['work', 'done', null],
    ]);
  });

  it('sends work back with the review, and stops after two rounds of work with a note', async () => {
    await setAutoReview(true);
    await start();
    let workJob = await take();
    for (let round = 1; round <= 2; round += 1) {
      await work();
      await finish(workJob?.run.id ?? '');
      const reviewJob = await take();
      expect(reviewJob?.run.role).toBe('review');
      await review('changes_requested');
      await finish(reviewJob?.run.id ?? '');
      workJob = await take();
      if (round === 1) expect(workJob?.run.role).toBe('work');
      if (round === 1) expect(workJob?.prompt).toContain('Add a test.');
    }
    expect(workJob).toBeNull();

    expect(await statusOf()).toBe('To do');
    expect((await runs()).map((run) => [run.role, run.chainStop])).toEqual([
      ['review', 'rounds'],
      ['work', null],
      ['review', null],
      ['work', null],
    ]);
  });

  it('stops when a person moved the ticket while Claude worked', async () => {
    await setAutoReview(true);
    await start();
    const job = await take();
    const { body } = await person<ProjectDetail>('GET', '/api/projects/MOB');
    const done = body.statuses.find((status) => status.category === 'done');
    await person('POST', '/api/tickets/MOB-1/move', { statusId: done?.id });
    await work();
    await finish(job?.run.id ?? '');

    expect(await take()).toBeNull();
    expect((await runs()).map((run) => [run.role, run.chainStop])).toEqual([['work', 'moved']]);
  });

  it('stops when the helper went offline before the work ended', async () => {
    await setAutoReview(true);
    await start();
    const job = await take();
    await work();
    clock.advance(RUNNER_ONLINE_MS);
    await finish(job?.run.id ?? '');

    expect((await runs()).map((run) => [run.role, run.chainStop])).toEqual([['work', 'offline']]);
  });

  it('goes no further after a run that failed', async () => {
    await setAutoReview(true);
    await start();
    const job = await take();
    await work();
    await finish(job?.run.id ?? '', 'failed');

    expect(await take()).toBeNull();
    expect((await runs()).map((run) => [run.status, run.chainStop])).toEqual([['failed', null]]);
  });
});
