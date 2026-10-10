import type { RunRequest } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { makeRequest } from '../../api/test/requestFixtures';
import { isWaiting, requestState, shownRequests } from './requestState';

const NOW = 1_000_000;
const open = (id: string, more: Partial<RunRequest> = {}) =>
  makeRequest({ id, createdAt: NOW - 10, expiresAt: NOW + 60_000, ...more });
const answered = (id: string, endedAt: number) =>
  open(id, { status: 'answered', decision: 'allow', endedAt });

describe('requestState', () => {
  it('is open until the deadline, answered once answered, and ended otherwise', () => {
    expect(requestState(open('a'), NOW)).toBe('open');
    expect(requestState(open('a', { expiresAt: NOW }), NOW)).toBe('ended');
    expect(requestState(answered('a', NOW - 1), NOW)).toBe('answered');
    expect(requestState(open('a', { status: 'expired', endedAt: NOW }), NOW)).toBe('ended');
    expect(requestState(open('a', { status: 'cancelled', endedAt: NOW }), NOW)).toBe('ended');
  });
});

describe('shownRequests', () => {
  it('shows every open request and only the one settled last', () => {
    const first = answered('a', NOW - 30);
    const second = open('b', { status: 'expired', endedAt: NOW - 20 });
    const waiting = open('c');
    const third = answered('d', NOW - 5);
    expect(shownRequests([first, second, waiting, third], NOW)).toEqual([waiting, third]);
  });

  it('takes a request past its deadline as settled at the deadline', () => {
    const late = open('a', { expiresAt: NOW - 1 });
    const earlier = answered('b', NOW - 50);
    expect(shownRequests([earlier, late], NOW)).toEqual([late]);
  });

  it('shows nothing for a run that asked nothing', () => {
    expect(shownRequests([], NOW)).toEqual([]);
  });
});

describe('isWaiting', () => {
  it('waits while any request is open', () => {
    expect(isWaiting([answered('a', NOW - 1), open('b')], NOW)).toBe(true);
    expect(isWaiting([answered('a', NOW - 1), open('b', { expiresAt: NOW })], NOW)).toBe(false);
    expect(isWaiting([], NOW)).toBe(false);
  });
});
