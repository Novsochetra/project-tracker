import type { PlanLimitsInput } from '@tracker/shared';
import { describe, expect, it, vi } from 'vitest';
import type { ClaudeExit } from '../../src/watch/outcome';
import { createRunOutput } from '../../src/watch/stream/runOutput';
import { createWatcher } from '../../src/watch/watcher';
import { answered, askJob, fakeTracker, job, RUNNER } from './fakeTracker';

const SETTINGS = { runnerId: RUNNER, name: 'Mac', projectKey: 'MOB', trackerUrl: 'http://t.test' };
const LIMITS: PlanLimitsInput = { status: 'allowed', usedPercent: 40, resetsAt: 1_800_000_000_000 };

const rateLimitEvent = (utilization: number) => ({
  type: 'rate_limit_event',
  rate_limit_info: { status: 'allowed', utilization },
});

describe('plan limits at a run end', () => {
  it('keeps the last rate limit event a run printed', () => {
    const output = createRunOutput({ onOutput: () => undefined, onEvent: () => undefined });
    output.event(rateLimitEvent(0.2));
    output.event(rateLimitEvent(0.45));
    output.event({ type: 'rate_limit_event', rate_limit_info: { status: 'unheard-of' } });
    const exit = output.exit({ code: 0, signal: null });
    expect(exit.planLimits).toEqual({ status: 'allowed', usedPercent: 45 });
  });

  it('sends no runner id with an end that has no limits', async () => {
    const tracker = fakeTracker([job('r-1', 'MOB-1')]);
    const exit: ClaudeExit = { code: 0, signal: null, output: '', results: [] };
    const runClaude = vi.fn().mockResolvedValue(exit);
    const watcher = createWatcher(
      { api: tracker.api, runClaude, runAsk: vi.fn(), log: () => undefined },
      SETTINGS,
    );
    await watcher.lookForWork();
    expect(tracker.ended).toEqual([{ id: 'r-1', status: 'done' }]);
  });

  it('has none when Claude Code printed none, as with an API key', () => {
    const output = createRunOutput({ onOutput: () => undefined, onEvent: () => undefined });
    expect(output.exit({ code: 0, signal: null })).not.toHaveProperty('planLimits');
  });

  it('sends them with the end of a ticket run and of a question', async () => {
    const tracker = fakeTracker([job('r-1', 'MOB-1'), askJob('r-2', 'c0ffee00-chat')]);
    const exit: ClaudeExit = { code: 0, signal: null, output: '', results: [], planLimits: LIMITS };
    const watcher = createWatcher(
      {
        api: tracker.api,
        runClaude: vi.fn().mockResolvedValue(exit),
        runAsk: vi.fn().mockResolvedValue({ ...answered('Yes.'), planLimits: LIMITS }),
        log: () => undefined,
      },
      SETTINGS,
    );
    await watcher.lookForWork();
    // The two lanes run side by side, so either may end first.
    expect(tracker.ended.map(({ id, planLimits, runnerId }) => [id, planLimits, runnerId])).toEqual(
      expect.arrayContaining([
        ['r-1', LIMITS, RUNNER],
        ['r-2', LIMITS, RUNNER],
      ]),
    );
    expect(tracker.ended).toHaveLength(2);
  });
});
