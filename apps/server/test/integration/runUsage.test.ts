import { randomUUID } from 'node:crypto';
import type {
  ChatDetail,
  ProjectUsage,
  Run,
  RunJob,
  RunUsage,
  RunUsageInput,
} from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { testClock } from '../helpers/auth';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

const DAY_MS = 24 * 60 * 60 * 1000;
const FULL = { costMicros: 840_000, turns: 23, durationMs: 361_000 };

const sumOf = (runs: readonly Run[], field: keyof RunUsage): number | null => {
  const values = runs.flatMap((run) => {
    const value = run.usage?.[field] ?? null;
    return value === null ? [] : [value];
  });
  return values.length === 0 ? null : values.reduce((total, value) => total + value, 0);
};

describe.each(DIALECTS)('what each run took (%s)', (dialect) => {
  const clock = testClock();
  const api = useTestServer(dialect, { now: clock.now });
  const runner = randomUUID();
  let person: Caller;
  let helper: Caller;
  let other: Caller;
  let otherHelper: Caller;

  const usageOf = (as = person) => as<ProjectUsage>('GET', '/api/projects/MOB/usage');
  const ticketRuns = async (key: string) =>
    (await person<Run[]>('GET', `/api/tickets/${key}/runs`)).body;

  async function ranOn(ticket: string, usage?: RunUsageInput, as = { person, helper, runner }) {
    await as.helper('PUT', `/api/runners/${as.runner}`, helperName('Dara’s MacBook'));
    await as.person('POST', `/api/tickets/${ticket}/runs`, { runnerId: as.runner, prompt: 'Go' });
    const job = (await as.helper<RunJob>('POST', `/api/runners/${as.runner}/next?kind=ticket`))
      .body;
    clock.advance(1_000);
    const body = { status: 'done', ...(usage ? { usage } : {}) };
    return (await as.helper<Run>('POST', `/api/runs/${job.run.id}/finish`, body)).body;
  }

  beforeEach(async () => {
    clock.set(1_000_000);
    const owner = await addUser(api.db, 'owner@example.com', clock.now());
    const second = await addUser(api.db, 'second@example.com', clock.now());
    person = caller(() => api.app, owner.person);
    helper = caller(() => api.app, owner.helper);
    other = caller(() => api.app, second.person);
    otherHelper = caller(() => api.app, second.helper);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    for (const title of ['Crash', 'Login', 'Rename']) {
      await person('POST', '/api/projects/MOB/tickets', { title });
    }
  });

  it('keeps what the helper sent on the run, and nothing for a helper that sent none', async () => {
    expect((await ranOn('MOB-1', FULL)).usage).toEqual(FULL);
    expect((await ranOn('MOB-2', { turns: 3 })).usage).toEqual({
      costMicros: null,
      turns: 3,
      durationMs: null,
    });
    expect((await ranOn('MOB-3')).usage).toBeNull();
    expect((await ticketRuns('MOB-1'))[0]?.usage).toEqual(FULL);
  });

  it('refuses usage that is not a whole, positive number', async () => {
    await helper('PUT', `/api/runners/${runner}`, helperName('Dara’s MacBook'));
    await person('POST', '/api/tickets/MOB-1/runs', { runnerId: runner, prompt: 'Go' });
    const job = (await helper<RunJob>('POST', `/api/runners/${runner}/next?kind=ticket`)).body;
    const finish = (usage: unknown) =>
      helper('POST', `/api/runs/${job.run.id}/finish`, { status: 'done', usage });
    expect((await finish({ costMicros: 0.5 })).status).toBe(400);
    expect((await finish({ turns: -1 })).status).toBe(400);
    expect((await finish({ durationMs: '12' })).status).toBe(400);
  });

  it('shows what an answer took under it', async () => {
    await helper('PUT', `/api/runners/${runner}`, helperName('Dara’s MacBook'));
    const started = await person<ChatDetail>('POST', '/api/projects/MOB/chats', {
      runnerId: runner,
      text: 'Where are runs queued?',
    });
    const job = (await helper<RunJob>('POST', `/api/runners/${runner}/next?kind=ask`)).body;
    clock.advance(1_000);
    await helper('POST', `/api/runs/${job.run.id}/finish`, {
      status: 'done',
      answer: 'In runQueue.ts.',
      usage: FULL,
    });
    const { messages } = (await person<ChatDetail>('GET', `/api/chats/${started.body.chat.id}`))
      .body;
    expect(messages.map(({ role, usage }) => [role, usage])).toEqual([
      ['person', null],
      ['claude', FULL],
    ]);
  });

  it("totals the project's runs of the last 30 days, which is the sum of those runs", async () => {
    expect((await usageOf()).body).toEqual({
      days: 30,
      runs: 0,
      costMicros: null,
      turns: null,
      durationMs: null,
    });
    await ranOn('MOB-1', { costMicros: 9_000_000, turns: 400, durationMs: 9_000_000 });
    // A look in between keeps the person's session, which ends after 30 idle days.
    clock.advance(20 * DAY_MS);
    await usageOf();
    clock.advance(11 * DAY_MS);
    await ranOn('MOB-1', FULL);
    await ranOn('MOB-2', { costMicros: 3_719, turns: 2 });
    await ranOn('MOB-3');
    await ranOn('MOB-3', { durationMs: 4_206 });
    const recent = [...(await ticketRuns('MOB-1')), ...(await ticketRuns('MOB-2'))]
      .concat(await ticketRuns('MOB-3'))
      .filter((run) => run.usage && (run.endedAt ?? 0) >= clock.now() - 30 * DAY_MS);
    const { body } = await usageOf();
    expect(body).toEqual({
      days: 30,
      runs: recent.length,
      costMicros: sumOf(recent, 'costMicros'),
      turns: sumOf(recent, 'turns'),
      durationMs: sumOf(recent, 'durationMs'),
    });
    expect(body).toEqual({
      days: 30,
      runs: 3,
      costMicros: 843_719,
      turns: 25,
      durationMs: 365_206,
    });
  });

  it("leaves out another user's runs and hides their project", async () => {
    await other('POST', '/api/projects', { name: 'Theirs', key: 'OTH' });
    await other('POST', '/api/projects/OTH/tickets', { title: 'Theirs' });
    const theirRunner = randomUUID();
    await otherHelper('PUT', `/api/runners/${theirRunner}`, {
      name: 'Their Mac',
      projectKeys: ['OTH'],
    });
    await ranOn('OTH-1', FULL, { person: other, helper: otherHelper, runner: theirRunner });
    expect((await usageOf()).body.runs).toBe(0);
    expect((await person('GET', '/api/projects/OTH/usage')).status).toBe(404);
    expect((await other('GET', '/api/projects/OTH/usage')).body).toMatchObject({ runs: 1 });
  });
});
