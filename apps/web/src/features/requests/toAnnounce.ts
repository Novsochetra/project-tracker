import type { RunRequest } from '@tracker/shared';
import { isOpen } from './requestState';

// The chat and the ticket may both show a request, and it is read out once.
export const toAnnounce = (
  requests: readonly RunRequest[],
  now: number,
  announced: ReadonlySet<string>,
): RunRequest[] => requests.filter((request) => isOpen(request, now) && !announced.has(request.id));
