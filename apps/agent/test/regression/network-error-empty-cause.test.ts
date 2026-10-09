import { describe, expect, it } from 'vitest';
import { describeError } from '../../src/errors';

// Node's fetch tries ::1 and 127.0.0.1 for localhost and fails with an AggregateError whose
// message is empty, so "Could not reach the tracker ()" said nothing about why.
describe('a refused connection to localhost', () => {
  it('says why the tracker could not be reached', () => {
    const cause = Object.assign(
      new AggregateError([
        new Error('connect ECONNREFUSED ::1:4100'),
        new Error('connect ECONNREFUSED 127.0.0.1:4100'),
      ]),
      { code: 'ECONNREFUSED' },
    );
    const failure = new TypeError('fetch failed', { cause });
    expect(describeError(failure, { trackerUrl: 'http://localhost:4100' })).toBe(
      'Could not reach the tracker at http://localhost:4100 (connect ECONNREFUSED ::1:4100). Is it running? Check TRACKER_URL (or --url).',
    );
  });

  it('leaves out the reason when there is none', () => {
    const failure = new TypeError('fetch failed', { cause: new Error('') });
    expect(describeError(failure)).toBe(
      'Could not reach the tracker. Is it running? Check TRACKER_URL (or --url).',
    );
  });
});
