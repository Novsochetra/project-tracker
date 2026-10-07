import { describe, expect, it } from 'vitest';
import {
  formatFullDate,
  formatLongDay,
  formatRelative,
  formatShortDay,
  isOverdue,
  todayYmd,
  toYmd,
} from '../src/logic/format';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Local-time constructors keep every expectation independent of the machine's time zone.
const NOW = new Date(2026, 9, 9, 12, 0).getTime();
const TODAY = new Date(2026, 9, 7, 12, 0);

describe('toYmd', () => {
  it('formats the local date as YYYY-MM-DD with zero padding', () => {
    expect(toYmd(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(toYmd(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31');
  });
});

describe('todayYmd', () => {
  it('formats the given day', () => {
    expect(todayYmd(TODAY)).toBe('2026-10-07');
  });

  it('defaults to the current local day', () => {
    expect(todayYmd()).toBe(toYmd(new Date()));
  });
});

describe('formatFullDate', () => {
  it('formats a timestamp as a short month, day and year', () => {
    expect(formatFullDate(new Date(2026, 9, 2, 15, 30).getTime())).toBe('Oct 2, 2026');
  });
});

describe('formatRelative', () => {
  it.each([
    [0, 'just now'],
    [29 * SECOND, 'just now'],
    [59 * SECOND, 'just now'],
    [60 * SECOND, '1m ago'],
    [90 * SECOND, '2m ago'],
    [5 * MINUTE, '5m ago'],
    [59 * MINUTE, '59m ago'],
    [60 * MINUTE, '1h ago'],
    [89 * MINUTE, '1h ago'],
    [90 * MINUTE, '2h ago'],
    [3 * HOUR, '3h ago'],
    [23 * HOUR, '23h ago'],
    [24 * HOUR, '1d ago'],
    [36 * HOUR, '2d ago'],
    [6 * DAY, '6d ago'],
  ])('shows %i ms ago as %j', (age, label) => {
    expect(formatRelative(NOW - age, NOW)).toBe(label);
  });

  it('rounds each unit from the one before it', () => {
    expect(formatRelative(NOW - 59.5 * SECOND, NOW)).toBe('1m ago');
    expect(formatRelative(NOW - (59 * MINUTE + 30 * SECOND), NOW)).toBe('1h ago');
    expect(formatRelative(NOW - (23 * HOUR + 30 * MINUTE), NOW)).toBe('1d ago');
  });

  it('shows the full date from 7 days on', () => {
    const written = new Date(2026, 9, 2, 12, 0).getTime();

    expect(formatRelative(written, written + 7 * DAY)).toBe('Oct 2, 2026');
    expect(formatRelative(written, written + 6.5 * DAY)).toBe('Oct 2, 2026');
    expect(formatRelative(written, written + 400 * DAY)).toBe('Oct 2, 2026');
  });

  it('shows just now for timestamps in the future', () => {
    expect(formatRelative(NOW + 5 * MINUTE, NOW)).toBe('just now');
    expect(formatRelative(NOW + 3 * DAY, NOW)).toBe('just now');
  });

  it('measures from the current time by default', () => {
    expect(formatRelative(Date.now())).toBe('just now');
  });
});

describe('formatShortDay', () => {
  it('shows the month and day for a date in the current year', () => {
    expect(formatShortDay('2026-10-09', TODAY)).toBe('Oct 9');
    expect(formatShortDay('2026-01-01', TODAY)).toBe('Jan 1');
  });

  it('adds the year for a date in another year', () => {
    expect(formatShortDay('2027-01-05', TODAY)).toBe('Jan 5, 2027');
    expect(formatShortDay('2025-12-31', TODAY)).toBe('Dec 31, 2025');
  });

  it('returns input it cannot read unchanged', () => {
    expect(formatShortDay('', TODAY)).toBe('');
    expect(formatShortDay('soon', TODAY)).toBe('soon');
    expect(formatShortDay('2026-13-40', TODAY)).toBe('2026-13-40');
  });
});

describe('formatLongDay', () => {
  it('shows the weekday, month and day for a date in the current year', () => {
    expect(formatLongDay('2026-10-09', TODAY)).toBe('Fri, Oct 9');
    expect(formatLongDay('2026-10-07', TODAY)).toBe('Wed, Oct 7');
  });

  it('adds the year for a date in another year', () => {
    expect(formatLongDay('2027-10-09', TODAY)).toBe('Sat, Oct 9, 2027');
    expect(formatLongDay('2025-12-31', TODAY)).toBe('Wed, Dec 31, 2025');
  });

  it('returns input it cannot read unchanged', () => {
    expect(formatLongDay('', TODAY)).toBe('');
    expect(formatLongDay('next week', TODAY)).toBe('next week');
  });
});

describe('isOverdue', () => {
  it('is overdue when the due date is before today and the ticket is not done', () => {
    expect(isOverdue('2026-10-06', false, '2026-10-07')).toBe(true);
    expect(isOverdue('2025-12-31', false, '2026-01-01')).toBe(true);
  });

  it('is not overdue on the due date itself', () => {
    expect(isOverdue('2026-10-07', false, '2026-10-07')).toBe(false);
  });

  it('is not overdue before the due date', () => {
    expect(isOverdue('2026-10-08', false, '2026-10-07')).toBe(false);
  });

  it('is never overdue once done', () => {
    expect(isOverdue('2026-10-06', true, '2026-10-07')).toBe(false);
  });

  it('is never overdue without a due date', () => {
    expect(isOverdue('', false, '2026-10-07')).toBe(false);
  });

  it('compares with the current local day by default', () => {
    expect(isOverdue('2000-01-01', false)).toBe(true);
    expect(isOverdue('2999-01-01', false)).toBe(false);
  });
});
