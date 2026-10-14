import { describe, expect, it, vi } from 'vitest';
import type { RunWithKey } from '../../src/repositories/runs';
import type { ServiceContext } from '../../src/services/context';
import { carryOutApprovedPlan } from '../../src/services/planFollowUp';

vi.mock('../../src/repositories/runRequests', () => ({
  listRunRequestRows: () => Promise.reject(new Error('database gone')),
}));

// The run's end is saved before the follow-up, so the helper's finish must not fail after it.
describe('carrying out an approved plan', () => {
  it('only warns when something unexpected goes wrong', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const run = {
      id: 'r-1',
      status: 'done',
      kind: 'ask',
      askMode: 'plan',
      chatId: 'c-1',
      runnerId: 'h-1',
      endedAt: 1,
    } as RunWithKey;
    const ctx = { now: () => 2 } as unknown as ServiceContext;
    await expect(carryOutApprovedPlan(ctx, 'u-1', run)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      'The approved plan of run r-1 was not started:',
      expect.objectContaining({ message: 'database gone' }),
    );
    warn.mockRestore();
  });
});
