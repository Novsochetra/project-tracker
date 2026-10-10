import { describe, expect, it, vi } from 'vitest';
import { retryUntilAnswered } from '../../src/watch/retry';

// Reviewer 140: the end of a run was given up after 20 tries (about 4 minutes), and the next ask
// for a run then turned that finished run into "The helper restarted before it finished."
describe('regression: a run end is reported until the tracker answers', () => {
  it('keeps trying through a long outage, and says so once', async () => {
    const task = vi.fn<() => Promise<string>>();
    for (let i = 0; i < 30; i += 1) task.mockRejectedValueOnce(new TypeError('fetch failed'));
    task.mockResolvedValueOnce('answered');
    const onWait = vi.fn();
    expect(await retryUntilAnswered(task, { onWait, delay: () => 0 })).toBe('answered');
    expect(task).toHaveBeenCalledTimes(31);
    expect(onWait).toHaveBeenCalledTimes(1);
  });
});
