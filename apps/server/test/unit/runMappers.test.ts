import { RUNNER_ONLINE_MS } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { inScope, requireScope, scopeOf } from '../../src/auth/scope';
import type { RunnerRow } from '../../src/db/runTables';
import { parseProjectIds, toRunner } from '../../src/services/runMappers';

const runner = (projectIds: string, lastSeenAt = 1_000): RunnerRow => ({
  id: 'r-1',
  userId: 'u-1',
  name: 'Mac',
  projectIds,
  createdAt: 500,
  lastSeenAt,
});

describe('parseProjectIds', () => {
  it('reads the ids a helper serves, and nothing from a broken value', () => {
    expect(parseProjectIds(runner('["p-1","p-2"]'))).toEqual(['p-1', 'p-2']);
    expect(parseProjectIds(runner('["p-1",7,null]'))).toEqual(['p-1']);
    expect(parseProjectIds(runner('{"p-1":true}'))).toEqual([]);
    expect(parseProjectIds(runner('not json'))).toEqual([]);
  });
});

describe('toRunner', () => {
  const keys = new Map([['p-1', 'MOB']]);

  it('names projects by their current key and drops deleted ones', () => {
    expect(toRunner(runner('["p-1","p-gone"]'), keys, 1_000).projectKeys).toEqual(['MOB']);
  });

  it('is online for a minute after its last check-in', () => {
    expect(toRunner(runner('[]'), keys, 1_000 + RUNNER_ONLINE_MS - 1).online).toBe(true);
    expect(toRunner(runner('[]'), keys, 1_000 + RUNNER_ONLINE_MS).online).toBe(false);
  });
});

describe('user scope', () => {
  it("is the session's or token's user, and null on a tracker without an owner", () => {
    expect(scopeOf({ kind: 'session', userId: 'u-1', sessionId: 's', email: 'a@b.c' })).toBe('u-1');
    expect(scopeOf({ kind: 'token', userId: 'u-2', tokenId: 't' })).toBe('u-2');
    expect(scopeOf({ kind: 'open' })).toBeNull();
    expect(scopeOf(null)).toBeUndefined();
    expect(() => requireScope(undefined)).toThrow('Sign in to use this tracker.');
  });

  it('never matches a signed-in user with the open tracker', () => {
    expect(inScope(null, null)).toBe(true);
    expect(inScope('u-1', 'u-1')).toBe(true);
    expect(inScope(null, 'u-1')).toBe(false);
    expect(inScope('u-1', 'u-2')).toBe(false);
  });
});
