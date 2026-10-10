import { describe, expect, it } from 'vitest';
import { makeRequest } from '../../api/test/requestFixtures';
import { toAnnounce } from './toAnnounce';

describe('toAnnounce', () => {
  it('reads out each open request once, and never one that ended', () => {
    const now = Date.now();
    const first = makeRequest({ id: 'a' });
    const second = makeRequest({ id: 'b' });
    const ended = makeRequest({ id: 'c', status: 'cancelled', endedAt: now });
    expect(toAnnounce([first, second, ended], now, new Set(['a']))).toEqual([second]);
    expect(toAnnounce([first], now, new Set())).toEqual([first]);
  });
});
