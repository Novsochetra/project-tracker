import type { RunRequest } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { makeRequest } from './test/requestFixtures';
import { withRequest } from './runRequests';

const open = makeRequest({ id: 'q-1' });
const other = makeRequest({ id: 'q-2' });
const answered: RunRequest = { ...open, status: 'answered', decision: 'allow', endedAt: 2 };

describe('withRequest', () => {
  it('puts the answered request in its place', () => {
    expect(withRequest([open, other], answered)).toEqual([answered, other]);
  });

  it('adds a request the list did not have yet', () => {
    expect(withRequest(undefined, answered)).toEqual([answered]);
    expect(withRequest([other], answered)).toEqual([other, answered]);
  });

  it('keeps a request a newer read already ended', () => {
    const expired: RunRequest = { ...open, status: 'expired', endedAt: 3 };
    const list = [expired, other];
    expect(withRequest(list, answered)).toBe(list);
  });
});
