interface WeekInfo {
  firstDay?: number;
}

// Chromium and Safari 18 have getWeekInfo(); older Chromium, Safari 17 and Node a weekInfo getter;
// Firefox neither yet.
type LocaleWithWeek = Intl.Locale & {
  getWeekInfo?: () => WeekInfo | undefined;
  weekInfo?: WeekInfo;
};

const SUNDAY = 0;

function readFirstDay(locale: string): unknown {
  const intl = new Intl.Locale(locale) as LocaleWithWeek;
  const info = typeof intl.getWeekInfo === 'function' ? intl.getWeekInfo() : intl.weekInfo;
  return info?.firstDay;
}

// The weekday the locale's weeks start on (0 is Sunday), or Sunday when the browser can't tell.
export function localeWeekStart(locale: string | undefined): number {
  if (!locale) return SUNDAY;
  try {
    const firstDay = readFirstDay(locale);
    // Week info counts Monday as 1 and Sunday as 7.
    const known = typeof firstDay === 'number' && [1, 2, 3, 4, 5, 6, 7].includes(firstDay);
    return known ? firstDay % 7 : SUNDAY;
  } catch {
    return SUNDAY;
  }
}
