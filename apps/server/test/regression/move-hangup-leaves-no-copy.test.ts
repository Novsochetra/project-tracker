import { describe, expect, it } from 'vitest';
import { stopMoveWith } from '../helpers/stoppedMove';

// Reviewer 114 (PT-124): closing the terminal tab during a move sends SIGHUP, which only Ctrl-C
// and SIGTERM were handled for, so the copy of the whole database stayed in $TMPDIR and no line
// said whether rows were written.
describe('a move whose terminal tab is closed', () => {
  it('removes its copy of the database and says no rows were written', async () => {
    const { result, copiesLeft } = await stopMoveWith('SIGHUP');

    expect(result.code).toBe(129);
    expect(result.stderr).toContain('Stopped (SIGHUP). No rows were written to the target');
    expect(copiesLeft).toEqual([]);
  });
});
