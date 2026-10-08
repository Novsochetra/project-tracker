import { formatFullDate, formatRelative } from '@tracker/shared';

export interface TimeAgoProps {
  at: number;
  now: number;
}

export function TimeAgo({ at, now }: TimeAgoProps) {
  return (
    <time dateTime={new Date(at).toISOString()} title={formatFullDate(at)}>
      {formatRelative(at, now)}
    </time>
  );
}
