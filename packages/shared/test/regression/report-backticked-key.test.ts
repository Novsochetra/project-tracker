import { describe, expect, it } from 'vitest';
import { parseReport } from '../../src/logic/report';

describe('regression: a bold TICKET label with a backticked key', () => {
  it('parses **TICKET:** `MOB-2`', () => {
    const [block] = parseReport('**TICKET:** `MOB-2`\nSTATUS: done');
    expect(block?.key).toBe('MOB-2');
    expect(block?.category).toBe('in_review');
  });

  it('still parses the plain form', () => {
    expect(parseReport('TICKET: MOB-2')[0]?.key).toBe('MOB-2');
  });
});
