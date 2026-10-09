import { describe, expect, it } from 'vitest';
import { createLimiter } from '../../src/images/limiter';

const tick = () => new Promise((resolve) => setTimeout(resolve, 1));

describe('createLimiter', () => {
  it('runs at most the given number of tasks at once, the rest in turn', async () => {
    const limit = createLimiter(2);
    let running = 0;
    let most = 0;
    const started: number[] = [];
    const task = (index: number) => async () => {
      started.push(index);
      running += 1;
      most = Math.max(most, running);
      await tick();
      running -= 1;
      return index;
    };
    const results = await Promise.all([0, 1, 2, 3, 4].map((index) => limit(task(index))));
    expect(results).toEqual([0, 1, 2, 3, 4]);
    expect(started).toEqual([0, 1, 2, 3, 4]);
    expect(most).toBe(2);
  });

  it('frees the place of a task that fails', async () => {
    const limit = createLimiter(1);
    const failing = limit(() => Promise.reject(new Error('Unreadable image.')));
    const next = limit(() => Promise.resolve('next'));
    await expect(failing).rejects.toThrow('Unreadable image.');
    await expect(next).resolves.toBe('next');
    await expect(limit(() => Promise.resolve('later'))).resolves.toBe('later');
  });
});
