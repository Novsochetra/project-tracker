import { randomUUID } from 'node:crypto';
import type { HelperPlanUsage, PlanLimitsInput, RunJob } from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { testClock } from '../helpers/auth';
import { addUser, caller, helperName, type Caller } from '../helpers/runs';
import { DIALECTS, useTestServer } from '../helpers/server';

const LIMITS: PlanLimitsInput = {
  status: 'allowed_warning',
  rateLimitType: 'five_hour',
  usedPercent: 83,
  resetsAt: 1_800_000_000_000,
  windows: {
    five_hour: { usedPercent: 83, resetsAt: 1_800_000_000_000 },
    seven_day: { usedPercent: 21, resetsAt: 1_800_400_000_000 },
  },
  isUsingOverage: false,
};

describe.each(DIALECTS)("each helper's Claude plan usage (%s)", (dialect) => {
  const clock = testClock();
  const api = useTestServer(dialect, { now: clock.now });
  const runner = randomUUID();
  let person: Caller;
  let helper: Caller;
  let other: Caller;

  const usage = async (as = person) =>
    (await as<HelperPlanUsage[]>('GET', '/api/claude-usage')).body;

  async function startRun(ticket: string) {
    await person('POST', `/api/tickets/${ticket}/runs`, { runnerId: runner, prompt: 'Go' });
    return (await helper<RunJob>('POST', `/api/runners/${runner}/next?kind=ticket`)).body;
  }

  async function finish(ticket: string, planLimits?: unknown) {
    const job = await startRun(ticket);
    clock.advance(1_000);
    const body = { status: 'done', ...(planLimits === undefined ? {} : { planLimits }) };
    return helper('POST', `/api/runs/${job.run.id}/finish`, body);
  }

  beforeEach(async () => {
    clock.set(1_000_000);
    const owner = await addUser(api.db, 'owner@example.com', clock.now());
    const second = await addUser(api.db, 'second@example.com', clock.now());
    person = caller(() => api.app, owner.person);
    helper = caller(() => api.app, owner.helper);
    other = caller(() => api.app, second.person);
    await person('POST', '/api/projects', { name: 'Mobile', key: 'MOB' });
    for (const title of ['Crash', 'Login', 'Rename']) {
      await person('POST', '/api/projects/MOB/tickets', { title });
    }
    await helper('PUT', `/api/runners/${runner}`, helperName('Dara’s MacBook'));
  });

  it('says nothing is known until a run end carries the limits', async () => {
    expect(await usage()).toEqual([
      { runnerId: runner, runnerName: 'Dara’s MacBook', limits: null, seenAt: null },
    ]);
    await finish('MOB-1');
    expect((await usage())[0]?.limits).toBeNull();
  });

  it("keeps the latest a run end carried, on the tracker's clock", async () => {
    expect((await finish('MOB-1', LIMITS)).status).toBe(200);
    expect(await usage()).toEqual([
      { runnerId: runner, runnerName: 'Dara’s MacBook', limits: LIMITS, seenAt: 1_001_000 },
    ]);
    await finish('MOB-2');
    expect((await usage())[0]?.seenAt).toBe(1_001_000);
    await finish('MOB-3', { status: 'rejected', resetsAt: 1_800_000_000_000 });
    expect((await usage())[0]).toMatchObject({
      limits: { status: 'rejected', resetsAt: 1_800_000_000_000 },
      seenAt: 1_003_000,
    });
  });

  it('refuses limits out of bounds or of an unknown kind', async () => {
    const job = await startRun('MOB-1');
    const end = (planLimits: unknown) =>
      helper('POST', `/api/runs/${job.run.id}/finish`, { status: 'done', planLimits });
    expect((await end({ status: 'maybe' })).status).toBe(400);
    expect((await end({ status: 'allowed', usedPercent: 5_000 })).status).toBe(400);
    expect((await end({ status: 'allowed', resetsAt: 1.5 })).status).toBe(400);
    expect((await end({ status: 'allowed', rateLimitType: 'hourly' })).status).toBe(400);
    expect(
      (await end({ status: 'allowed', windows: { five_hour: { usedPercent: 1 } } })).status,
    ).toBe(400);
    expect((await usage())[0]?.limits).toBeNull();
  });

  it("is the person's own: agents are refused and other people see only theirs", async () => {
    await finish('MOB-1', LIMITS);
    expect((await helper('GET', '/api/claude-usage')).status).toBe(403);
    expect(await usage(other)).toEqual([]);
  });
});
