import { describe, expect, it } from 'vitest';
import { askEffortArgs } from '../../../src/watch/ask/askEffortArgs';

describe('askEffortArgs', () => {
  it.each(['low', 'medium', 'high', 'xhigh', 'max'])(
    'picks the %s effort by its fixed name',
    (effort) => {
      expect(askEffortArgs(effort)).toEqual(['--effort', effort]);
    },
  );

  it.each([
    'default',
    undefined,
    null,
    '',
    'HIGH',
    'ultra',
    '--dangerously-skip-permissions',
    'high --x',
    'toString',
    '__proto__',
    7,
    ['high'],
  ])('leaves the effort to Claude for %o', (effort) => {
    expect(askEffortArgs(effort)).toEqual([]);
  });
});
