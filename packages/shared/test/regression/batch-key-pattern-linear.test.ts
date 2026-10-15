import { describe, expect, it } from 'vitest';
import { RUN_STEP_TEXT_MAX } from '../../src/domain/runStep';
import { ticketRunIn } from '../../src/logic/runSteps/batchSteps';

// A key pattern with an unbounded word before the dash took about 64 ms for one such label, so a
// request of 100 steps held the server for seconds (PT-255 review).
describe('regression: finding a ticket key in a long label', () => {
  it('stays fast on a label that is one long word with no dash', () => {
    const label = `claim ${'a'.repeat(RUN_STEP_TEXT_MAX - 6)}`;
    const tickets = [{ runId: 'run-1', ticketKey: 'PT-1' }];
    const started = performance.now();
    for (let i = 0; i < 100; i += 1) expect(ticketRunIn(label, tickets)).toBeNull();
    expect(performance.now() - started).toBeLessThan(500);
  });
});
