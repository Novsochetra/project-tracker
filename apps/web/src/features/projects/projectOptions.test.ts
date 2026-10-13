import { describe, expect, it } from 'vitest';
import {
  deletedToast,
  deleteMenuMessage,
  deleteSheetCaption,
  projectUsageNote,
} from './projectOptions';

describe('delete confirmations', () => {
  it('counts the tickets in the menu confirm', () => {
    expect(deleteMenuMessage(7)).toBe(
      "Delete this project and its 7 tickets? This can't be undone.",
    );
    expect(deleteMenuMessage(1)).toBe(
      "Delete this project and its 1 ticket? This can't be undone.",
    );
  });

  it('names the project in the action sheet caption', () => {
    expect(deleteSheetCaption('Mobile app', 0)).toBe(
      "Delete “Mobile app” and its 0 tickets? This can't be undone.",
    );
  });

  it('quotes the name in the toast', () => {
    expect(deletedToast('Website')).toBe('“Website” deleted');
  });
});

describe('projectUsageNote', () => {
  it("says what Claude Code's runs took in the project's last days", () => {
    const usage = { days: 30, runs: 2, costMicros: 1_250_000, turns: 9, durationMs: 600_000 };
    expect(projectUsageNote(usage)).toEqual({
      label: 'Claude Code, last 30 days:',
      parts: ['2 runs', '10 min', '9 turns', 'about $1.25'],
    });
  });

  it('says nothing before it is read or when no run sent usage', () => {
    expect(projectUsageNote(undefined)).toBeNull();
    const none = { days: 30, runs: 0, costMicros: null, turns: null, durationMs: null };
    expect(projectUsageNote(none)).toBeNull();
  });
});
