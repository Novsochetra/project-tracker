import { describe, expect, it } from 'vitest';
import { VIEWING_MS, createChatViewers } from '../../../src/push/chatViewers';
import { testClock } from '../../helpers/auth';

describe('chat viewers', () => {
  it('knows the one chat a sign-in shows, until it leaves or goes quiet', () => {
    const clock = testClock();
    const viewers = createChatViewers(clock.now);
    viewers.view('s-1', 'c-1');
    expect(viewers.shows('s-1', 'c-1')).toBe(true);
    expect(viewers.shows('s-1', 'c-2')).toBe(false);
    expect(viewers.shows('s-2', 'c-1')).toBe(false);
    expect(viewers.shows(null, 'c-1')).toBe(false);
    expect(viewers.shows('s-1', null)).toBe(false);
    viewers.view('s-1', 'c-2');
    expect(viewers.shows('s-1', 'c-1')).toBe(false);
    viewers.view('s-1', null);
    expect(viewers.shows('s-1', 'c-2')).toBe(false);
    viewers.view('s-1', 'c-1');
    clock.advance(VIEWING_MS);
    expect(viewers.shows('s-1', 'c-1')).toBe(false);
  });

  it('forgets the oldest sign-in past its limit', () => {
    const viewers = createChatViewers(testClock().now);
    for (let i = 0; i <= 10_000; i += 1) viewers.view(`s-${i}`, 'c-1');
    expect(viewers.shows('s-0', 'c-1')).toBe(false);
    expect(viewers.shows('s-1', 'c-1')).toBe(true);
    expect(viewers.shows('s-10000', 'c-1')).toBe(true);
  });
});
