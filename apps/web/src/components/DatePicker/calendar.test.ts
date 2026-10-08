import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  dayNumber,
  fullDateLabel,
  isYmd,
  monthGrid,
  monthLabel,
  monthOf,
  nextMonday,
  shortWeekday,
  weekdayColumns,
  weekEndOf,
  weekStartOf,
} from './calendar';

const SUNDAY = 0;
const MONDAY = 1;
const SATURDAY = 6;

const consecutive = (days: string[]) =>
  days.every((day, i) => i === 0 || addDays(days[i - 1]!, 1) === day);

describe('addDays', () => {
  it('crosses month and year edges both ways', () => {
    expect(addDays('2026-10-08', 1)).toBe('2026-10-09');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2026-10-29', 7)).toBe('2026-11-05');
    expect(addDays('2026-10-03', -7)).toBe('2026-09-26');
  });

  it('knows leap years, including the century rules', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    expect(addDays('2100-02-28', 1)).toBe('2100-03-01');
    expect(addDays('2000-02-28', 1)).toBe('2000-02-29');
  });
});

describe('addMonths', () => {
  it('keeps the day, or takes the last day of a shorter month', () => {
    expect(addMonths('2026-10-08', 1)).toBe('2026-11-08');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
    expect(addMonths('2026-05-31', 1)).toBe('2026-06-30');
  });

  it('crosses year edges', () => {
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15');
    expect(addMonths('2026-12-31', 2)).toBe('2027-02-28');
  });
});

describe('weeks', () => {
  it('start on the given weekday', () => {
    expect(weekStartOf('2026-10-08', SUNDAY)).toBe('2026-10-04');
    expect(weekEndOf('2026-10-08', SUNDAY)).toBe('2026-10-10');
    expect(weekStartOf('2026-10-08', MONDAY)).toBe('2026-10-05');
    expect(weekEndOf('2026-10-08', MONDAY)).toBe('2026-10-11');
    expect(weekStartOf('2026-10-08', SATURDAY)).toBe('2026-10-03');
  });

  it('keep a day that already starts or ends its week', () => {
    expect(weekStartOf('2026-10-04', SUNDAY)).toBe('2026-10-04');
    expect(weekEndOf('2026-10-10', SUNDAY)).toBe('2026-10-10');
    expect(weekStartOf('2026-10-11', MONDAY)).toBe('2026-10-05');
    expect(weekEndOf('2026-10-11', MONDAY)).toBe('2026-10-11');
  });

  it('reach into the neighbouring month', () => {
    expect(weekStartOf('2026-10-01', SUNDAY)).toBe('2026-09-27');
    expect(weekEndOf('2026-09-30', SUNDAY)).toBe('2026-10-03');
    expect(weekStartOf('2027-01-01', MONDAY)).toBe('2026-12-28');
  });
});

describe('monthGrid', () => {
  it('is six full weeks from the week holding the first of the month', () => {
    const weeks = monthGrid('2026-10-20', SUNDAY);
    expect(weeks).toHaveLength(6);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[0]![0]).toBe('2026-09-27');
    expect(weeks[5]![6]).toBe('2026-11-07');
    expect(consecutive(weeks.flat())).toBe(true);
  });

  it('follows the week start', () => {
    expect(monthGrid('2026-10-20', MONDAY)[0]![0]).toBe('2026-09-28');
    expect(monthGrid('2026-10-20', SATURDAY)[0]![0]).toBe('2026-09-26');
  });

  it('starts on the first when the month starts the week', () => {
    // February 2026 starts on a Sunday.
    expect(monthGrid('2026-02-10', SUNDAY)[0]![0]).toBe('2026-02-01');
    expect(monthGrid('2026-02-10', MONDAY)[0]![0]).toBe('2026-01-26');
  });

  it('holds every day of a leap February', () => {
    const days = monthGrid('2028-02-01', SUNDAY).flat();
    expect(days).toContain('2028-02-29');
    expect(days.filter((day) => monthOf(day) === '2028-02')).toHaveLength(29);
  });
});

describe('nextMonday', () => {
  it('is the first Monday after today', () => {
    expect(nextMonday('2026-10-08')).toBe('2026-10-12');
    expect(nextMonday('2026-10-10')).toBe('2026-10-12');
    expect(nextMonday('2026-10-11')).toBe('2026-10-12');
    expect(nextMonday('2026-10-12')).toBe('2026-10-19');
    expect(nextMonday('2026-12-31')).toBe('2027-01-04');
  });
});

describe('labels', () => {
  it('name a day in full, the month with its year, and the weekday', () => {
    expect(fullDateLabel('2026-10-08')).toBe('Thursday, October 8, 2026');
    expect(monthLabel('2026-10-08')).toBe('October 2026');
    expect(shortWeekday('2026-10-08')).toBe('Thu');
    expect(dayNumber('2026-10-08')).toBe(8);
    expect(monthOf('2026-10-08')).toBe('2026-10');
  });

  it('name the weekday columns from the week start', () => {
    expect(
      weekdayColumns(SUNDAY)
        .map((column) => column.initial)
        .join(''),
    ).toBe('SMTWTFS');
    expect(weekdayColumns(SUNDAY)[0]!.name).toBe('Sunday');
    expect(weekdayColumns(MONDAY).map((column) => column.name)).toEqual([
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ]);
  });
});

describe('isYmd', () => {
  it('accepts real dates only', () => {
    expect(isYmd('2026-10-08')).toBe(true);
    expect(isYmd('2028-02-29')).toBe(true);
    expect(isYmd('')).toBe(false);
    expect(isYmd('2026-02-29')).toBe(false);
    expect(isYmd('2026-13-01')).toBe(false);
    expect(isYmd('2026-10-8')).toBe(false);
    expect(isYmd('soon')).toBe(false);
  });
});

// Local midnight can be missing (Santiago skips 00:00 on 2026-09-06) or come twice, and a day
// can last 23 or 25 hours. None of that may skip, repeat or shift a date.
describe.each([
  ['America/New_York', '2026-03-08', '2026-11-01'],
  ['Europe/Berlin', '2026-03-29', '2026-10-25'],
  ['America/Santiago', '2026-09-06', '2026-04-05'],
  ['Pacific/Kiritimati', '2026-10-08', '2026-10-08'],
  ['Pacific/Pago_Pago', '2026-10-08', '2026-10-08'],
])('in %s', (zone, springForward, fallBack) => {
  let previous: string | undefined;
  beforeAll(() => {
    previous = process.env.TZ;
    process.env.TZ = zone;
  });
  afterAll(() => {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  });

  it('steps over daylight saving days one date at a time', () => {
    for (const day of [springForward, fallBack]) {
      expect(addDays(addDays(day, -1), 1)).toBe(day);
      expect(addDays(day, 1)).not.toBe(day);
      expect(addDays(addDays(day, 1), -1)).toBe(day);
      expect(addMonths(addMonths(day, 1), -1)).toBe(day);
    }
  });

  it('builds the daylight saving months without gaps or repeats', () => {
    for (const day of [springForward, fallBack]) {
      const days = monthGrid(day, SUNDAY).flat();
      expect(new Set(days).size).toBe(42);
      expect(consecutive(days)).toBe(true);
      expect(days).toContain(day);
    }
  });

  it('names the dates it shows', () => {
    expect(fullDateLabel(springForward)).toMatch(new RegExp(`${dayNumber(springForward)}, 2026$`));
    expect(fullDateLabel('2026-10-08')).toBe('Thursday, October 8, 2026');
    expect(weekStartOf('2026-10-08', SUNDAY)).toBe('2026-10-04');
  });
});
