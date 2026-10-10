import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { ignoreClosedTerminal } from '../../src/cli/terminal';

// Reviewer 140: closing the terminal made the next log line throw "write EIO", which crashed the
// helper before it could report its run as cancelled or let go of the folder.
describe('regression: a closed terminal', () => {
  it('drops output instead of crashing', async () => {
    const closed = new Writable({
      write: (_chunk, _encoding, done) =>
        done(Object.assign(new Error('write EIO'), { code: 'EIO' })),
    });
    ignoreClosedTerminal(closed);
    closed.write('Stopping…\n');
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(closed.listenerCount('error')).toBeGreaterThan(0);
  });
});
