import { getEventListeners } from 'node:events';
import { describe, expect, it } from 'vitest';
import { wait } from '../../src/watch/wait';

describe('wait', () => {
  it('leaves no listener behind, and ends at once on abort', async () => {
    const stop = new AbortController();
    for (let i = 0; i < 5; i += 1) await wait(1, stop.signal);
    expect(getEventListeners(stop.signal, 'abort')).toHaveLength(0);
    const started = Date.now();
    const long = wait(60_000, stop.signal);
    stop.abort();
    await long;
    await wait(60_000, stop.signal);
    expect(Date.now() - started).toBeLessThan(1_000);
  });
});
