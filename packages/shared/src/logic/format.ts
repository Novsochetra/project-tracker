const LOCALE = 'en-US';

const parseDay = (ymd: string): Date => new Date(`${ymd}T00:00:00`);

const pad = (value: number): string => String(value).padStart(2, '0');

const KB = 1024;
const MB = 1024 * 1024;

export const toYmd = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const todayYmd = (now: Date = new Date()): string => toYmd(now);

export function formatFullDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(LOCALE, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatRelative(timestamp: number, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatFullDate(timestamp);
}

function formatDay(ymd: string, now: Date, options: Intl.DateTimeFormatOptions): string {
  const date = parseDay(ymd);
  if (Number.isNaN(date.getTime())) return ymd;
  const withYear =
    date.getFullYear() === now.getFullYear() ? options : { ...options, year: 'numeric' as const };
  return date.toLocaleDateString(LOCALE, withYear);
}

export const formatShortDay = (ymd: string, now: Date = new Date()): string =>
  formatDay(ymd, now, { month: 'short', day: 'numeric' });

export const formatLongDay = (ymd: string, now: Date = new Date()): string =>
  formatDay(ymd, now, { weekday: 'short', month: 'short', day: 'numeric' });

export const isOverdue = (due: string, isDone: boolean, today: string = todayYmd()): boolean =>
  Boolean(due) && due < today && !isDone;

export function formatBytes(bytes: number): string {
  if (bytes < KB) return `${bytes} B`;
  if (bytes < MB) return `${Math.round(bytes / KB)} KB`;
  return `${(bytes / MB).toFixed(1)} MB`;
}
