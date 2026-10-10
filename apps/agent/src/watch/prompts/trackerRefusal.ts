import { ApiError } from '@tracker/client';

export const UNREACHABLE =
  "The tracker couldn't be reached to ask the person, so this was not allowed.";
export const NOT_RUNNING = 'This run is no longer running on the tracker, so nobody can answer.';
export const HELPER_REFUSED =
  "The tracker didn't let this helper ask the person (its API token was refused), so this was not allowed.";
export const HELPER_OUTDATED =
  "The tracker didn't take this helper's request, so this was not allowed. Update and restart tracker watch.";
export const RUN_GONE = 'This run is gone from the tracker, so nobody can answer.';

// Every later call would get the same answer, so the helper stops asking and tells Claude why.
export function refusalOf(error: unknown): string | undefined {
  if (!(error instanceof ApiError)) return undefined;
  // A tracker newer than the helper refuses a request in the old shape.
  if (error.status === 400) return HELPER_OUTDATED;
  if (error.status === 401 || error.status === 403) return HELPER_REFUSED;
  if (error.status === 404) return RUN_GONE;
  if (error.status === 409) return NOT_RUNNING;
  return undefined;
}
