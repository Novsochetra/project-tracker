import { describe, expect, it } from 'vitest';
import { stampLines } from '../../src/cli/terminal';

describe('stampLines', () => {
  it('puts the time on every line of a message', () => {
    expect(stampLines('Error: no\nsecond', new Date('2026-10-10T03:04:05.000Z'))).toBe(
      '2026-10-10T03:04:05.000Z Error: no\n2026-10-10T03:04:05.000Z second',
    );
  });
});
