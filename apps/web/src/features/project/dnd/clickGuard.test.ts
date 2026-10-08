import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { armClickGuard, consumeClickGuard } from './clickGuard';

describe('click guard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    consumeClickGuard();
    vi.useRealTimers();
  });

  it('lets clicks through when no drag ended', () => {
    expect(consumeClickGuard()).toBe(false);
  });

  it('swallows one click in the task that ended the drag', () => {
    armClickGuard();
    expect(consumeClickGuard()).toBe(true);
    expect(consumeClickGuard()).toBe(false);
  });

  it('expires when that task is over', () => {
    armClickGuard();
    vi.advanceTimersToNextTimer();
    expect(consumeClickGuard()).toBe(false);
  });
});
