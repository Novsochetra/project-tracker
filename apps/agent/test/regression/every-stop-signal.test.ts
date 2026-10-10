import { describe, expect, it } from 'vitest';
import { untilSignal } from '../../src/cli/terminal';

// Reviewer 140: after the first stop signal the other two kept their handlers, so `kill`, a logout
// or a supervisor could not end a helper still trying to report its run.
describe('regression: after the first stop signal', () => {
  it('leaves every signal to its default, so the next one ends the process', async () => {
    const before = ['SIGINT', 'SIGTERM', 'SIGHUP'].map((name) => process.listenerCount(name));
    const stopped = untilSignal();
    process.emit('SIGINT');
    await stopped;
    const after = ['SIGINT', 'SIGTERM', 'SIGHUP'].map((name) => process.listenerCount(name));
    expect(after).toEqual(before);
  });
});
