import { sortStatuses, type Status } from '@tracker/shared';
import { SEP } from './text';

export const formatStatusLine = (status: Status): string =>
  `${status.name}${SEP}${status.category}`;

export function formatStatuses(statuses: readonly Status[]): string {
  if (statuses.length === 0) return 'No statuses.';
  return sortStatuses(statuses).map(formatStatusLine).join('\n');
}
