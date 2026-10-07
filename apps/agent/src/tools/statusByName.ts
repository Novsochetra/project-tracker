import { findStatusByName, sortStatuses, type Status } from '@tracker/shared';
import { ToolError } from '../errors';

export function statusByName(statuses: readonly Status[], name: string): Status {
  const status = findStatusByName(statuses, name);
  if (status) return status;
  const valid = sortStatuses(statuses)
    .map((candidate) => `"${candidate.name}"`)
    .join(', ');
  throw new ToolError(`There is no status named "${name.trim()}". Valid statuses: ${valid}.`);
}
