import { describe, expect, it } from 'vitest';
import { makeRunner } from '../../api/test/runFixtures';
import { helperDetails } from './helperText';

const NOW = 1_000_000_000;

describe('helperDetails', () => {
  it('lists the projects and whether the computer is online', () => {
    expect(helperDetails(makeRunner({ projectKeys: ['MOB', 'WEB'] }), NOW)).toBe(
      'MOB, WEB · Online',
    );
  });

  it('says when an offline computer was last seen', () => {
    const offline = makeRunner({ online: false, lastSeenAt: NOW - 2 * 60 * 60 * 1000 });
    expect(helperDetails(offline, NOW)).toBe('MOB · Last seen 2h ago');
  });

  it('leaves the projects out once none is left', () => {
    expect(helperDetails(makeRunner({ projectKeys: [] }), NOW)).toBe('Online');
  });
});
