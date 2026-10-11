import { describe, expect, it } from 'vitest';
import { createProblemLog } from '../../src/watch/problems';

const BACK = 'In touch with the tracker again.';

function logged() {
  const lines: string[] = [];
  return { lines, note: createProblemLog((text) => lines.push(text)) };
}

describe('the problem log', () => {
  it('says a problem once, however many sources report it', () => {
    const { lines, note } = logged();
    note('check-in', 'down');
    note('ticket', 'down');
    note('check-in', 'down');
    expect(lines).toEqual(['down']);
  });

  it('says the tracker is back only when every source is fine', () => {
    const { lines, note } = logged();
    note('ticket', 'down');
    note('ask', 'refused');
    note('ticket', undefined);
    expect(lines).toEqual(['down', 'refused']);
    note('ask', undefined);
    expect(lines).toEqual(['down', 'refused', BACK]);
  });

  it('says nothing when a source is fine and nothing was wrong', () => {
    const { lines, note } = logged();
    note('ticket', undefined);
    expect(lines).toEqual([]);
  });
});
