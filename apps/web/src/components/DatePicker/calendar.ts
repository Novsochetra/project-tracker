// Days are 'YYYY-MM-DD' strings, like a ticket's due date. The math runs on UTC dates, which have
// no daylight saving gaps or repeats, so a day is always exactly one date in every time zone.
export type Ymd = string;

const LOCALE = 'en-US';
const WEEK = 7;
const GRID_WEEKS = 6;
const MONDAY = 1;
const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

const pad = (value: number, size = 2): string => String(value).padStart(size, '0');

function toUtc(day: Ymd): Date {
  const [year = 0, month = 1, date = 1] = day.split('-').map(Number);
  const utc = new Date(0);
  // setUTCFullYear, unlike Date.UTC, doesn't read years 0–99 as 1900–1999.
  utc.setUTCFullYear(year, month - 1, date);
  return utc;
}

const fromUtc = (date: Date): Ymd =>
  `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

const weekdayOf = (day: Ymd): number => toUtc(day).getUTCDay();

export const isYmd = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && fromUtc(toUtc(value)) === value;

export function addDays(day: Ymd, days: number): Ymd {
  const date = toUtc(day);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUtc(date);
}

export function addMonths(day: Ymd, months: number): Ymd {
  const date = toUtc(day);
  const target = new Date(0);
  target.setUTCFullYear(date.getUTCFullYear(), date.getUTCMonth() + months, 1);
  const lastDay = new Date(0);
  lastDay.setUTCFullYear(target.getUTCFullYear(), target.getUTCMonth() + 1, 0);
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay.getUTCDate()));
  return fromUtc(target);
}

export const monthOf = (day: Ymd): string => day.slice(0, 7);

export const dayNumber = (day: Ymd): number => Number(day.slice(8, 10));

export const weekStartOf = (day: Ymd, weekStart: number): Ymd =>
  addDays(day, -((weekdayOf(day) - weekStart + WEEK) % WEEK));

export const weekEndOf = (day: Ymd, weekStart: number): Ymd =>
  addDays(weekStartOf(day, weekStart), WEEK - 1);

// Always six weeks, so the calendar keeps its height from month to month.
export function monthGrid(day: Ymd, weekStart: number): Ymd[][] {
  const first = weekStartOf(`${monthOf(day)}-01`, weekStart);
  return Array.from({ length: GRID_WEEKS }, (_, week) =>
    Array.from({ length: WEEK }, (_, weekday) => addDays(first, week * WEEK + weekday)),
  );
}

export function nextMonday(today: Ymd): Ymd {
  const ahead = (MONDAY - weekdayOf(today) + WEEK) % WEEK;
  return addDays(today, ahead === 0 ? WEEK : ahead);
}

// Made once: every render of the calendar names 42 days.
const FULL_DATE = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});
const MONTH = new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric', timeZone: 'UTC' });

export const fullDateLabel = (day: Ymd): string => FULL_DATE.format(toUtc(day));

export const monthLabel = (day: Ymd): string => MONTH.format(toUtc(day));

export const shortWeekday = (day: Ymd): string => DAY_NAMES[weekdayOf(day)]!.slice(0, 3);

export interface WeekdayColumn {
  name: string;
  initial: string;
}

export const weekdayColumns = (weekStart: number): WeekdayColumn[] =>
  Array.from({ length: WEEK }, (_, index) => {
    const name = DAY_NAMES[(weekStart + index) % WEEK]!;
    return { name, initial: name.charAt(0) };
  });
