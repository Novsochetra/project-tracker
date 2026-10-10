import { describe, expect, it } from 'vitest';
import { isCut } from './stepClamp';

const text = { kind: 'text' } as const;
const older = { newest: false, whole: false };

describe('isCut', () => {
  it("cuts Claude's earlier words while it works, never its newest", () => {
    expect(isCut('live', text, older)).toBe(true);
    expect(isCut('live', text, { ...older, newest: true })).toBe(false);
  });

  it('cuts nothing once the person opened every earlier step', () => {
    expect(isCut('live', text, { ...older, whole: true })).toBe(false);
  });

  it("cuts nothing in a folded answer's list or a sheet, and never a call", () => {
    expect(isCut('history', text, older)).toBe(false);
    expect(isCut('full', text, older)).toBe(false);
    expect(isCut('live', { kind: 'tool' }, older)).toBe(false);
    expect(isCut('live', { kind: 'denied' }, older)).toBe(false);
  });
});
