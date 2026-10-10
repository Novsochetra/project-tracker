import { describe, expect, it } from 'vitest';
import { stopMoveWith } from '../helpers/stoppedMove';

// Ctrl-C ended the move without its cleanup, so the temporary copy of the whole database stayed
// in $TMPDIR (16 of them after a day of runs).
describe('a move stopped by a signal', () => {
  it.each([
    ['SIGINT', 130],
    ['SIGTERM', 143],
  ] as const)('removes its copy of the database: %s', async (signal, code) => {
    const { result, copiesLeft } = await stopMoveWith(signal);

    expect(result.code).toBe(code);
    expect(result.stderr).toContain('No rows were written to the target');
    expect(copiesLeft).toEqual([]);
  });
});
