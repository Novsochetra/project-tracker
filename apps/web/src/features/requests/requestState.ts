import type { RunRequest } from '@tracker/shared';

export type RequestState = 'open' | 'answered' | 'ended';

type Timed = Pick<RunRequest, 'status' | 'expiresAt'>;

// The tracker ends a request past its deadline only when it is next read, so the phone's own clock
// takes the buttons away first.
export function requestState(request: Timed, now: number): RequestState {
  if (request.status === 'answered') return 'answered';
  return request.status === 'open' && now < request.expiresAt ? 'open' : 'ended';
}

export const isOpen = (request: Timed, now: number): boolean =>
  requestState(request, now) === 'open';

const settledAt = (request: RunRequest): number => request.endedAt ?? request.expiresAt;

function lastSettled(requests: readonly RunRequest[], now: number): RunRequest | undefined {
  let last: RunRequest | undefined;
  for (const request of requests) {
    if (isOpen(request, now)) continue;
    if (!last || settledAt(request) >= settledAt(last)) last = request;
  }
  return last;
}

// Every open request, and the one settled last, so a tap shows what it did without a pile of old
// answers growing under the steps, which already show what Claude did with each.
export function shownRequests(requests: readonly RunRequest[], now: number): RunRequest[] {
  const last = lastSettled(requests, now);
  return requests.filter((request) => request === last || isOpen(request, now));
}

export const isWaiting = (requests: readonly RunRequest[], now: number): boolean =>
  requests.some((request) => isOpen(request, now));
