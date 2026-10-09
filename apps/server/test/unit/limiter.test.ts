import { describe, expect, it } from 'vitest';
import { createLimiter, createWorkLimiter } from '../../src/images/limiter';

const tick = () => new Promise((resolve) => setTimeout(resolve, 1));

function tracker() {
  let running = 0;
  let most = 0;
  const started: string[] = [];
  const task = (name: string) => async () => {
    started.push(name);
    running += 1;
    most = Math.max(most, running);
    await tick();
    running -= 1;
    return name;
  };
  return { task, started, most: () => most };
}

describe('createWorkLimiter', () => {
  it('runs tasks together while their costs fit, the rest in turn', async () => {
    const limit = createWorkLimiter(100);
    const { task, started, most } = tracker();
    const names = ['a', 'b', 'c', 'd', 'e'];
    const results = await Promise.all(names.map((name) => limit(50, task(name))));
    expect(results).toEqual(names);
    expect(started).toEqual(names);
    expect(most()).toBe(2);
  });

  it('runs a task bigger than the capacity alone', async () => {
    const limit = createWorkLimiter(100);
    const { task, most } = tracker();
    await Promise.all([
      limit(30, task('small')),
      limit(250, task('huge')),
      limit(30, task('next')),
    ]);
    expect(most()).toBe(1);
  });

  // A small task that slipped past a big one waiting for room could keep it waiting forever.
  it('never lets a later task pass one waiting for room', async () => {
    const limit = createWorkLimiter(100);
    const { task, started } = tracker();
    await Promise.all([limit(60, task('first')), limit(60, task('big')), limit(10, task('small'))]);
    expect(started).toEqual(['first', 'big', 'small']);
  });

  it('frees the room of a task that fails', async () => {
    const limit = createWorkLimiter(1);
    const failing = limit(1, () => Promise.reject(new Error('Unreadable image.')));
    const next = limit(1, () => Promise.resolve('next'));
    await expect(failing).rejects.toThrow('Unreadable image.');
    await expect(next).resolves.toBe('next');
    await expect(limit(1, () => Promise.resolve('later'))).resolves.toBe('later');
  });
});

describe('createLimiter', () => {
  it('runs at most the given number of tasks at once', async () => {
    const limit = createLimiter(2);
    const { task, started, most } = tracker();
    await Promise.all(['a', 'b', 'c', 'd'].map((name) => limit(task(name))));
    expect(started).toEqual(['a', 'b', 'c', 'd']);
    expect(most()).toBe(2);
  });
});
