import { ApiError } from '@tracker/client';
import { errorMessage, isNetworkError } from '../../api';

export const TOO_SLOW_MESSAGE = 'It took too long to send. Try again on a faster connection.';
export const TOO_BIG_FOR_SERVER_MESSAGE = "The server won't take a file this big.";
export const NOT_SAVED_MESSAGE = "The tracker couldn't save it. Try again.";

// A bare 5xx (no error body) comes from a proxy for a stopped API, but also from the API itself or
// from a proxy whose connection to it broke during this upload. Only a check of the tracker tells
// them apart, and the banner says when it can't be reached, so the note says only what is true of
// all of them (PT-109).
const isBare5xx = (error: unknown): boolean => error instanceof ApiError && isNetworkError(error);

// Node and proxies stop these with a bare status line ("Request Timeout"), which says nothing to
// someone whose file is gone.
export function uploadFailureReason(error: unknown): string {
  if (error instanceof ApiError && error.status === 408) return TOO_SLOW_MESSAGE;
  if (error instanceof ApiError && error.status === 413) return TOO_BIG_FOR_SERVER_MESSAGE;
  if (isBare5xx(error)) return NOT_SAVED_MESSAGE;
  return errorMessage(error);
}
