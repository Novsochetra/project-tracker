import { ApiError } from '@tracker/client';
import { errorMessage } from '../../api';

export const TOO_SLOW_MESSAGE = 'It took too long to send. Try again on a faster connection.';
export const TOO_BIG_FOR_SERVER_MESSAGE = "The server won't take a file this big.";

// Node and proxies stop these with a bare status line ("Request Timeout"), which says nothing to
// someone whose file is gone.
export function uploadFailureReason(error: unknown): string {
  if (error instanceof ApiError && error.status === 408) return TOO_SLOW_MESSAGE;
  if (error instanceof ApiError && error.status === 413) return TOO_BIG_FOR_SERVER_MESSAGE;
  return errorMessage(error);
}
